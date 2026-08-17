import {
  addMember,
  createBook,
  createCashFlow,
  createJointAccount,
  createTrade,
  setAllocationSchedule,
} from "@/ledger";
import { money, moneyString } from "@/ledger/money";
import { scheduleInForce } from "@/ledger/set-allocation-schedule";
import type { LedgerStore } from "@/ledger/store";
import { CANON_SCHEDULES, MEMBER_HEY, MEMBER_SZE, normalizeScheduleLegs, splitByPercents } from "./canon";
import { membersForBook } from "./own";
import type { ImportDecisions, ImportPlan, PendingChoice, PlannedTrade } from "./types";

export type ImportWriters = {
  createBook: typeof createBook;
  addMember: typeof addMember;
  createJointAccount: typeof createJointAccount;
  setAllocationSchedule: typeof setAllocationSchedule;
  createCashFlow: typeof createCashFlow;
  createTrade: typeof createTrade;
};

const defaultWriters: ImportWriters = {
  createBook,
  addMember,
  createJointAccount,
  setAllocationSchedule,
  createCashFlow,
  createTrade,
};

export type ApplyResult = {
  bookId: string;
  cashFlowCount: number;
  tradeCount: number;
  warningCount: number;
  skippedCount: number;
  rowLog: { id: string; status: "written" | "warning" | "skipped"; message: string }[];
};

function choiceFor(plan: ImportPlan, trade: PlannedTrade, decisions: ImportDecisions): PendingChoice | "write" {
  if (trade.skip) {
    return "skip";
  }
  const pendingIds = plan.issues
    .filter(
      (issue) =>
        issue.pending &&
        (trade.warningIds.includes(issue.id) ||
          (issue.sheet === "transinfo" && issue.row === trade.row) ||
          (issue.symbol && issue.symbol.toUpperCase() === trade.symbol.toUpperCase() && issue.sheet === "transinfo")),
    )
    .map((issue) => issue.id);
  if (pendingIds.length === 0 && !trade.pending) {
    return "write";
  }
  const picks = pendingIds.map((id) => decisions.pending[id]);
  if (picks.some((pick) => pick === "skip")) {
    return "skip";
  }
  if (picks.length > 0 && picks.every((pick) => pick === "import")) {
    return "import";
  }
  if (trade.pending || pendingIds.length > 0) {
    return "skip";
  }
  return "write";
}

export async function applyImport(
  store: LedgerStore,
  plan: ImportPlan,
  input: {
    createdByUserId: string;
    creatorDisplayName: string;
    creatorEmail?: string | null;
    bookName?: string;
    decisions: ImportDecisions;
    /** Re-import onto this Book. Claim is not an unlock — membership must already exist. */
    existingBookId?: string;
  },
  writers: Partial<ImportWriters> = {},
): Promise<ApplyResult> {
  if (plan.blocking) {
    throw new Error("欄位未確認，零寫入。");
  }

  const w = { ...defaultWriters, ...writers };
  const rowLog: ApplyResult["rowLog"] = [];
  const pendingUnresolved = plan.issues.filter(
    (issue) => issue.pending && !input.decisions.pending[issue.id],
  );
  if (pendingUnresolved.length > 0) {
    throw new Error("待確認列未揀 一併匯入／略過。");
  }

  if (
    input.existingBookId &&
    input.decisions.reimportMode !== "append" &&
    input.decisions.reimportMode !== "replace"
  ) {
    throw new Error("再匯入要明示追加或取代");
  }

  const members = new Map<string, { memberId: string; accountId: string }>();
  let bookId: string;

  if (input.existingBookId) {
    bookId = input.existingBookId;
    const existingMembers = await store.listMembers(bookId);
    const existingAccounts = await store.listLedgerAccounts(bookId);
    for (const member of existingMembers) {
      const personal = existingAccounts.find((row) => row.memberId === member.id && row.kind === "personal");
      if (personal) {
        members.set(member.displayName.trim().toLowerCase(), {
          memberId: member.id,
          accountId: personal.id,
        });
      }
    }
  } else {
    const created = await w.createBook(store, {
      name: (input.bookName ?? "聯倉").trim() || "聯倉",
      createdByUserId: input.createdByUserId,
      creatorDisplayName: input.creatorDisplayName,
      creatorEmail: input.creatorEmail,
    });
    bookId = created.book.id;
    members.set(created.member.displayName.trim().toLowerCase(), {
      memberId: created.member.id,
      accountId: created.account.id,
    });
  }

  const needed = new Set<string>(plan.members);
  for (const name of [MEMBER_HEY, MEMBER_SZE]) {
    if (plan.trades.some((trade) => !trade.skip && trade.book === "joint")) {
      needed.add(name);
    }
  }
  for (const name of needed) {
    const key = name.trim().toLowerCase();
    if (members.has(key)) {
      continue;
    }
    const added = await w.addMember(store, { bookId, displayName: name });
    members.set(key, { memberId: added.member.id, accountId: added.account.id });
  }

  const lookup = (name: string) => {
    const row = members.get(name.trim().toLowerCase());
    if (!row) {
      throw new Error(`搵唔到成員 ${name}，無開幽靈戶口。`);
    }
    return row;
  };

  const existingAccounts = await store.listLedgerAccounts(bookId);
  const joint =
    existingAccounts.find((row) => row.kind === "joint") ??
    (await w.createJointAccount(store, { bookId, name: "聯名" }));

  const existingSchedules = await store.listAllocationSchedules(bookId);
  if (existingSchedules.length === 0) {
    for (const name of [MEMBER_HEY, MEMBER_SZE]) {
      const key = name.trim().toLowerCase();
      if (members.has(key)) {
        continue;
      }
      const added = await w.addMember(store, { bookId, displayName: name });
      members.set(key, { memberId: added.member.id, accountId: added.account.id });
    }
    for (const schedule of CANON_SCHEDULES) {
      const legs = normalizeScheduleLegs(schedule.legs).map((leg) => ({
        memberId: lookup(leg.name).memberId,
        percent: leg.percent,
      }));
      await w.setAllocationSchedule(store, {
        bookId,
        effectiveOn: schedule.effectiveOn,
        legs,
      });
    }
  }

  const schedules = await store.listAllocationSchedules(bookId);

  if (input.decisions.reimportMode === "replace") {
    await store.clearBookEntries(bookId);
  }

  let cashFlowCount = 0;
  let tradeCount = 0;
  let skippedCount = 0;

  for (const flow of plan.cashFlows) {
    if (flow.skip) {
      skippedCount += 1;
      rowLog.push({ id: flow.id, status: "skipped", message: `出入金第 ${flow.row} 行略過` });
      continue;
    }
    const member = lookup(flow.memberName);
    await w.createCashFlow(store, {
      bookId,
      memberId: member.memberId,
      ledgerAccountId: member.accountId,
      kind: flow.kind,
      amountHkd: flow.amountHkd,
      fxRate: flow.fxRate,
      occurredOn: flow.occurredOn,
    });
    cashFlowCount += 1;
    rowLog.push({ id: flow.id, status: "written", message: `出入金第 ${flow.row} 行已寫入` });
  }

  for (const issue of plan.issues) {
    if (issue.kind.startsWith("missing") || issue.kind === "unknown_own") {
      skippedCount += 1;
      rowLog.push({ id: issue.id, status: "skipped", message: issue.message });
    }
  }

  for (const trade of plan.trades) {
    const decision = choiceFor(plan, trade, input.decisions);
    if (decision === "skip") {
      skippedCount += 1;
      rowLog.push({ id: trade.id, status: "skipped", message: `買賣第 ${trade.row} 行略過` });
      continue;
    }

    const accountId = trade.book === "joint" ? joint.id : lookup(membersForBook(trade.book)[0]).accountId;
    const memberId = lookup(membersForBook(trade.book)[0]).memberId;
    const schedule = scheduleInForce(schedules, trade.buyDate);
    const legs =
      trade.book === "joint"
        ? jointLegs(schedule, trade.quantity, trade.buyTotal, lookup)
        : undefined;

    await w.createTrade(store, {
      bookId,
      ledgerAccountId: accountId,
      memberId,
      symbol: trade.symbol,
      quantity: trade.quantity,
      price: trade.buyPrice,
      occurredOn: trade.buyDate,
      side: "buy",
      costUsd: trade.buyTotal,
      legs,
      note: trade.own ? `Own ${trade.own}` : null,
    });
    tradeCount += 1;

    if (trade.sellDate) {
      const sellQty = trade.quantity;
      const proceeds = trade.sellTotal ?? moneyString(money(sellQty).mul(money(trade.sellPrice ?? "0")));
      if (!trade.sellTotal && !trade.sellPrice) {
        skippedCount += 1;
        rowLog.push({
          id: `${trade.id}-sell`,
          status: "skipped",
          message: `買賣第 ${trade.row} 行有賣出日但缺賣出價／總額，只寫入買入。`,
        });
      } else {
        const sellLegs =
          trade.book === "joint" ? jointLegs(schedule, sellQty, proceeds, lookup, "proceeds") : undefined;
        await w.createTrade(store, {
          bookId,
          ledgerAccountId: accountId,
          memberId,
          symbol: trade.symbol,
          quantity: sellQty,
          price:
            trade.sellPrice ??
            moneyString(money(proceeds).div(money(sellQty))),
          occurredOn: trade.sellDate,
          side: "sell",
          proceedsUsd: proceeds,
          feeUsd: trade.sellFee ?? undefined,
          legs: sellLegs,
          note: trade.own ? `Own ${trade.own}` : null,
        });
        tradeCount += 1;
      }
    }

    const warn = trade.warningIds.length > 0 || decision === "import";
    rowLog.push({
      id: trade.id,
      status: warn ? "warning" : "written",
      message: warn
        ? `買賣第 ${trade.row} 行已寫入（警告／待確認）`
        : `買賣第 ${trade.row} 行已寫入`,
    });
  }

  const warningCount = rowLog.filter((row) => row.status === "warning").length + plan.issues.filter((i) => i.pending && input.decisions.pending[i.id] === "import").length;

  return {
    bookId,
    cashFlowCount,
    tradeCount,
    warningCount,
    skippedCount,
    rowLog,
  };
}

function jointLegs(
  schedule: { legs: { memberId: string; percent: string }[] } | null,
  quantity: string,
  total: string,
  lookup: (name: string) => { memberId: string; accountId: string },
  field: "cost" | "proceeds" = "cost",
) {
  const hey = lookup(MEMBER_HEY).memberId;
  const sze = lookup(MEMBER_SZE).memberId;
  const percents = schedule
    ? [hey, sze].map((id) => {
        const leg = schedule.legs.find((item) => item.memberId === id);
        return leg?.percent ?? "0";
      })
    : normalizeScheduleLegs(CANON_SCHEDULES[0].legs).map((leg) => leg.percent);
  const qtys = splitByPercents(quantity, percents);
  const amounts = splitByPercents(total, percents);
  return [
    {
      memberId: hey,
      quantity: qtys[0],
      costUsd: field === "cost" ? amounts[0] : "0",
      proceedsUsd: field === "proceeds" ? amounts[0] : "0",
    },
    {
      memberId: sze,
      quantity: qtys[1],
      costUsd: field === "cost" ? amounts[1] : "0",
      proceedsUsd: field === "proceeds" ? amounts[1] : "0",
    },
  ];
}
