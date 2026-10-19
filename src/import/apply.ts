import {
  addMember,
  createAdjustment,
  createBook,
  createCashFlow,
  createJointAccount,
  createSplit,
  createTrade,
  setAllocationSchedule,
} from "@/ledger";
import { jointTradeLegs } from "@/ledger/joint-legs";
import { money, moneyString } from "@/ledger/money";
import { scheduleInForce } from "@/ledger/set-allocation-schedule";
import type { AllocationScheduleView, LedgerStore } from "@/ledger/store";
import type { CreateTradeLeg } from "@/ledger/types";
import { MEMBER_HEY, MEMBER_SZE, splitByPercents } from "./canon";
import { membersForBook } from "./own";
import type { ImportDecisions, ImportPlan, PendingChoice, PlannedAllocationSchedule, PlannedTrade } from "./types";

export type ImportWriters = {
  createBook: typeof createBook;
  addMember: typeof addMember;
  createJointAccount: typeof createJointAccount;
  setAllocationSchedule: typeof setAllocationSchedule;
  createCashFlow: typeof createCashFlow;
  createTrade: typeof createTrade;
  createSplit: typeof createSplit;
  createAdjustment: typeof createAdjustment;
};

const defaultWriters: ImportWriters = {
  createBook,
  addMember,
  createJointAccount,
  setAllocationSchedule,
  createCashFlow,
  createTrade,
  createSplit,
  createAdjustment,
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

function holderIssueMessage(
  plan: ImportPlan,
  sheet: "transinfo" | "account",
  row: number,
  fallback: string,
): string {
  const issue = plan.issues.find(
    (item) =>
      item.sheet === sheet &&
      item.row === row &&
      (item.kind === "unknown_member" || item.kind === "empty_holder" || item.kind === "ambiguous_holder"),
  );
  return issue?.message ?? fallback;
}

function heySzeFiftyFifty(
  lookup: (name: string) => { memberId: string; accountId: string },
  quantity: string,
  amountUsd: string,
  field: "cost" | "proceeds",
): CreateTradeLeg[] {
  const qtys = splitByPercents(quantity || "0", ["0.5", "0.5"]);
  const amounts = splitByPercents(amountUsd || "0", ["0.5", "0.5"]);
  return [MEMBER_HEY, MEMBER_SZE].map((name, index) => ({
    memberId: lookup(name).memberId,
    quantity: qtys[index] ?? "0",
    costUsd: field === "cost" ? amounts[index] : "0",
    proceedsUsd: field === "proceeds" ? amounts[index] : "0",
  }));
}

function tradeAmountField(trade: PlannedTrade): {
  quantity: string;
  total: string;
  field: "cost" | "proceeds";
} {
  if (trade.side === "sell") {
    return {
      quantity: trade.quantity || "0",
      total: trade.sellTotal ?? trade.buyTotal,
      field: "proceeds",
    };
  }
  if (trade.side === "adjustment") {
    const raw = (trade.buyTotal ?? "0").trim();
    try {
      if (money(raw).lt(0)) {
        return { quantity: trade.quantity || "0", total: money(raw).abs().toString(), field: "cost" };
      }
    } catch {
      /* proceeds */
    }
    return { quantity: trade.quantity || "0", total: raw || "0", field: "proceeds" };
  }
  return { quantity: trade.quantity || "0", total: trade.buyTotal, field: "cost" };
}

function resolvedTradeLegs(
  trade: PlannedTrade,
  lookup: (name: string) => { memberId: string; accountId: string },
  destSchedules: AllocationScheduleView[],
  fileMemberIds: { id: string }[],
): CreateTradeLeg[] | undefined {
  if (trade.customLegs?.length) {
    return trade.customLegs.map((leg) => ({
      memberId: lookup(leg.memberName).memberId,
      quantity: leg.quantity,
      costUsd: leg.costUsd,
      proceedsUsd: leg.proceedsUsd,
    }));
  }
  if (trade.legacyHeySze && trade.book === "joint") {
    const { quantity, total, field } = tradeAmountField(trade);
    return heySzeFiftyFifty(lookup, quantity, total, field);
  }
  if (trade.book !== "joint") {
    return undefined;
  }
  const occurredOn = trade.side === "sell" ? (trade.sellDate ?? trade.buyDate) : trade.buyDate;
  if (scheduleInForce(destSchedules, occurredOn) || fileMemberIds.length === 0) {
    return undefined;
  }
  const { quantity, total, field } = tradeAmountField(trade);
  return jointTradeLegs({
    scheduleLegs: null,
    members: fileMemberIds,
    quantity,
    total,
    field,
  });
}

function scheduleSignature(
  legs: { memberName: string; percent: string }[],
): string {
  return legs
    .map((leg) => `${leg.memberName.trim().toLowerCase()}:${money(leg.percent).toFixed(8)}`)
    .sort()
    .join("|");
}

function storedScheduleSignature(
  schedule: AllocationScheduleView,
  namesById: Map<string, string>,
): string {
  return scheduleSignature(
    schedule.legs.map((leg) => ({
      memberName: namesById.get(leg.memberId) ?? leg.memberId,
      percent: leg.percent,
    })),
  );
}

async function writeImportedSchedules(
  store: LedgerStore,
  w: ImportWriters,
  bookId: string,
  imported: PlannedAllocationSchedule[],
  lookup: (name: string) => { memberId: string; accountId: string },
  mode: ImportDecisions["reimportMode"],
): Promise<void> {
  if (imported.length === 0) {
    return;
  }
  const existing = await store.listAllocationSchedules(bookId);
  const members = await store.listMembers(bookId);
  const namesById = new Map(members.map((row) => [row.id, row.displayName]));
  const existingByDate = new Map<string, AllocationScheduleView[]>();
  for (const schedule of existing) {
    const list = existingByDate.get(schedule.effectiveOn) ?? [];
    list.push(schedule);
    existingByDate.set(schedule.effectiveOn, list);
  }

  for (const schedule of imported) {
    const sameDate = existingByDate.get(schedule.effectiveOn) ?? [];
    if (mode === "append" && sameDate.length > 0) {
      const incoming = scheduleSignature(schedule.legs);
      const identical = sameDate.some((row) => storedScheduleSignature(row, namesById) === incoming);
      if (identical) {
        continue;
      }
      throw new Error(
        `Allocation 生效日 ${schedule.effectiveOn} 已有唔同分配，追加模式唔會覆蓋。要取代請揀 replace。`,
      );
    }
    await w.setAllocationSchedule(store, {
      bookId,
      effectiveOn: schedule.effectiveOn,
      legs: schedule.legs.map((leg) => ({
        memberId: lookup(leg.memberName).memberId,
        percent: leg.percent,
      })),
    });
  }
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
  const mappingBlock = plan.issues.some(
    (issue) =>
      issue.kind === "unmapped_column" ||
      issue.kind === "column_collision" ||
      issue.kind === "missing_required" ||
      issue.kind === "allocation_invalid" ||
      issue.kind === "tradesplit_invalid" ||
      issue.kind === "duplicate_member" ||
      (issue.kind === "unknown_member" && issue.sheet === "tradesplits"),
  );
  if (mappingBlock) {
    const named = plan.issues.find(
      (issue) =>
        issue.kind === "allocation_invalid" ||
        issue.kind === "tradesplit_invalid" ||
        issue.kind === "duplicate_member" ||
        (issue.kind === "unknown_member" && issue.sheet === "tradesplits"),
    );
    if (named) {
      throw new Error(named.message);
    }
    throw new Error("欄位未確認，零寫入。");
  }

  const snapshot = store.checkpoint();
  try {
    return await applyImportBody(store, plan, input, writers);
  } catch (error) {
    store.restore(snapshot);
    throw error;
  }
}

async function applyImportBody(
  store: LedgerStore,
  plan: ImportPlan,
  input: {
    createdByUserId: string;
    creatorDisplayName: string;
    creatorEmail?: string | null;
    bookName?: string;
    decisions: ImportDecisions;
    existingBookId?: string;
  },
  writers: Partial<ImportWriters>,
): Promise<ApplyResult> {
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

  const importedSchedules = plan.schedules ?? [];
  const needed = new Set<string>(plan.members);
  if (plan.trades.some((trade) => trade.legacyHeySze && !trade.skip && !trade.holderError)) {
    needed.add(MEMBER_HEY);
    needed.add(MEMBER_SZE);
  }
  if (
    plan.hasAllocationSheet !== true &&
    plan.trades.some(
      (trade) =>
        trade.side === "split" &&
        !trade.skip &&
        !trade.holderError &&
        !trade.memberName.trim() &&
        !trade.customLegs?.length,
    )
  ) {
    needed.add(MEMBER_HEY);
  }
  for (const name of needed) {
    if (!name?.trim()) {
      continue;
    }
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

  const firstMember = () => {
    const row = members.values().next().value as { memberId: string; accountId: string } | undefined;
    if (!row) {
      throw new Error("未有成員");
    }
    return row;
  };

  const postingMember = (trade: PlannedTrade) => {
    if (trade.book === "joint") {
      if (trade.memberName.trim()) {
        return lookup(trade.memberName);
      }
      const splitMember = trade.customLegs?.[0]?.memberName.trim();
      if (splitMember) {
        return lookup(splitMember);
      }
      if (trade.side === "split" && plan.hasAllocationSheet !== true) {
        return lookup(MEMBER_HEY);
      }
      return firstMember();
    }
    const names = membersForBook(trade.book, trade.memberName);
    return lookup(names[0] ?? trade.memberName);
  };

  const existingAccounts = await store.listLedgerAccounts(bookId);
  const hasJoint = plan.trades.some((trade) => !trade.skip && !trade.holderError && trade.book === "joint");
  const needsJoint =
    hasJoint || importedSchedules.length > 0 || existingAccounts.some((row) => row.kind === "joint");
  const joint = needsJoint
    ? (existingAccounts.find((row) => row.kind === "joint") ??
      (await w.createJointAccount(store, { bookId, name: "聯名" })))
    : null;

  if (input.decisions.reimportMode === "replace") {
    await store.clearBookEntries(bookId, {
      preserveSchedules: plan.hasAllocationSheet !== true,
    });
  }

  await writeImportedSchedules(
    store,
    w,
    bookId,
    importedSchedules,
    lookup,
    input.decisions.reimportMode,
  );
  const destSchedules = await store.listAllocationSchedules(bookId);
  const fileMemberIds: { id: string }[] = [];
  const seenFileMembers = new Set<string>();
  for (const name of needed) {
    try {
      const id = lookup(name).memberId;
      if (!seenFileMembers.has(id)) {
        seenFileMembers.add(id);
        fileMemberIds.push({ id });
      }
    } catch {
      /* not on this book */
    }
  }

  let cashFlowCount = 0;
  let tradeCount = 0;
  let skippedCount = 0;

  for (const flow of plan.cashFlows) {
    if (flow.holderError) {
      throw new Error(
        holderIssueMessage(plan, "account", flow.row, `Account Detail 第 ${flow.row} 行 holder 無效。`),
      );
    }
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
    if (trade.holderError) {
      throw new Error(
        holderIssueMessage(plan, "transinfo", trade.row, `TransInfo 第 ${trade.row} 行 holder 無效。`),
      );
    }
    const decision = choiceFor(plan, trade, input.decisions);
    if (decision === "skip") {
      skippedCount += 1;
      rowLog.push({ id: trade.id, status: "skipped", message: `買賣第 ${trade.row} 行略過` });
      continue;
    }

    const memberRef = postingMember(trade);
    if (trade.book === "joint" && !joint) {
      throw new Error("聯名倉未開，無寫入幽靈戶口。");
    }
    const accountId = trade.book === "joint" ? joint!.id : memberRef.accountId;
    const memberId = memberRef.memberId;
    const customLegs = resolvedTradeLegs(trade, lookup, destSchedules, fileMemberIds);

    if (trade.side === "split") {
      await w.createSplit(store, {
        bookId,
        ledgerAccountId: accountId,
        memberId,
        symbol: trade.symbol,
        newShares: trade.quantity,
        oldShares: trade.buyPrice,
        occurredOn: trade.buyDate,
        note: trade.note,
      });
      tradeCount += 1;
      rowLog.push({
        id: trade.id,
        status: "written",
        message: `拆股第 ${trade.row} 行已寫入`,
      });
      continue;
    }

    if (trade.side === "adjustment") {
      const amountUsd = trade.buyTotal && trade.buyTotal !== "0" ? trade.buyTotal : null;
      await w.createAdjustment(store, {
        bookId,
        ledgerAccountId: accountId,
        memberId,
        occurredOn: trade.buyDate,
        note: trade.note?.trim() || "匯入調整",
        symbol: trade.symbol,
        amountUsd,
        legs: customLegs,
      });
      tradeCount += 1;
      rowLog.push({
        id: trade.id,
        status: "written",
        message: `調整第 ${trade.row} 行已寫入`,
      });
      continue;
    }

    if (trade.side === "sell") {
      const proceeds = trade.sellTotal ?? trade.buyTotal;
      const sellPrice =
        trade.sellPrice ??
        trade.buyPrice ??
        moneyString(money(proceeds).div(money(trade.quantity)));
      await w.createTrade(store, {
        bookId,
        ledgerAccountId: accountId,
        memberId,
        symbol: trade.symbol,
        quantity: trade.quantity,
        price: sellPrice,
        occurredOn: trade.sellDate ?? trade.buyDate,
        side: "sell",
        proceedsUsd: proceeds,
        feeUsd: trade.sellFee ?? undefined,
        legs: customLegs,
        note: trade.note?.trim() ? trade.note.trim() : null,
      });
      tradeCount += 1;
      rowLog.push({
        id: trade.id,
        status: "written",
        message: `賣出第 ${trade.row} 行已寫入`,
      });
      continue;
    }

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
      feeUsd: trade.buyFee ?? undefined,
      legs: customLegs,
      note: trade.note?.trim() ? trade.note.trim() : null,
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
          note: null,
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

  if (input.decisions.reimportMode === "replace" && plan.hasMembersSheet) {
    await pruneUnclaimedLeftoverMembers(store, bookId, plan.listedMembers);
  }

  const warningCount =
    rowLog.filter((row) => row.status === "warning").length +
    plan.issues.filter((i) => i.pending && input.decisions.pending[i.id] === "import").length;

  return {
    bookId,
    cashFlowCount,
    tradeCount,
    warningCount,
    skippedCount,
    rowLog,
  };
}

async function pruneUnclaimedLeftoverMembers(
  store: LedgerStore,
  bookId: string,
  listedMembers: readonly string[],
): Promise<void> {
  const keep = new Set(listedMembers.map((name) => name.trim().toLowerCase()).filter(Boolean));
  if (keep.size === 0) {
    return;
  }
  const [destMembers, cash, allocations, schedules] = await Promise.all([
    store.listMembers(bookId),
    store.listCashFlows(bookId),
    store.listTradeAllocations(bookId),
    store.listAllocationSchedules(bookId),
  ]);
  const cashIds = new Set(cash.map((row) => row.memberId));
  const allocIds = new Set(allocations.map((row) => row.memberId));
  const scheduleIds = new Set(schedules.flatMap((row) => row.legs.map((leg) => leg.memberId)));
  for (const member of destMembers) {
    const key = member.displayName.trim().toLowerCase();
    if (keep.has(key) || member.userId) {
      continue;
    }
    if (cashIds.has(member.id) || allocIds.has(member.id) || scheduleIds.has(member.id)) {
      continue;
    }
    await store.removeUnclaimedMember(bookId, member.id);
  }
}
