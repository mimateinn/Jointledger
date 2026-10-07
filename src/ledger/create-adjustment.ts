import { jointTradeLegs } from "./joint-legs";
import { money, moneyString } from "./money";
import { scheduleInForce } from "./set-allocation-schedule";
import type { LedgerStore } from "./store";
import type { CreateAdjustmentInput, CreateTradeLeg, Trade, TradeAllocation } from "./types";

export async function createAdjustment(
  store: LedgerStore,
  input: CreateAdjustmentInput,
): Promise<{ trade: Trade; allocation: TradeAllocation; allocations: TradeAllocation[] }> {
  const note = input.note.trim();
  if (!note) {
    throw new Error("調整要寫備註");
  }

  const rawAmount = (input.amountUsd ?? "").trim().replace(/^\+/, "");
  let costUsd = moneyString("0");
  let proceedsUsd = moneyString("0");
  let field: "cost" | "proceeds" = "proceeds";
  let absTotal = "0";
  if (rawAmount !== "") {
    const amount = money(rawAmount);
    if (amount.gt(0)) {
      proceedsUsd = moneyString(amount);
      absTotal = proceedsUsd;
      field = "proceeds";
    } else if (amount.lt(0)) {
      costUsd = moneyString(amount.abs());
      absTotal = costUsd;
      field = "cost";
    }
  }

  const symbol = input.symbol?.trim().toUpperCase() || "—";

  const trade = await store.insertTrade({
    bookId: input.bookId,
    ledgerAccountId: input.ledgerAccountId,
    symbol,
    side: "adjustment",
    quantity: moneyString("0"),
    price: moneyString("0"),
    feeUsd: moneyString("0"),
    occurredOn: input.occurredOn,
    note,
  });

  let sources: CreateTradeLeg[] | null = input.legs?.length ? input.legs : null;
  if (!sources) {
    const account = await store.getLedgerAccount(input.ledgerAccountId);
    if (account?.kind === "joint") {
      const schedules = await store.listAllocationSchedules(input.bookId);
      const members = await store.listMembers(input.bookId);
      const schedule = scheduleInForce(schedules, input.occurredOn);
      sources = jointTradeLegs({
        scheduleLegs: schedule?.legs ?? null,
        members,
        quantity: "0",
        total: absTotal,
        field,
      });
    } else {
      sources = [
        {
          memberId: input.memberId,
          quantity: "0",
          costUsd,
          proceedsUsd,
        },
      ];
    }
  }

  const allocations: TradeAllocation[] = [];
  let costLeft = money(costUsd);
  let proceedsLeft = money(proceedsUsd);
  for (const [index, leg] of sources.entries()) {
    const last = index === sources.length - 1;
    const legCost =
      leg.costUsd != null && String(leg.costUsd).trim() !== ""
        ? money(leg.costUsd)
        : last
          ? costLeft
          : money("0");
    const legProceeds =
      leg.proceedsUsd != null && String(leg.proceedsUsd).trim() !== ""
        ? money(leg.proceedsUsd)
        : last
          ? proceedsLeft
          : money("0");
    costLeft = costLeft.minus(legCost);
    proceedsLeft = proceedsLeft.minus(legProceeds);
    allocations.push(
      await store.insertTradeAllocation({
        tradeId: trade.id,
        memberId: leg.memberId,
        quantity: moneyString(leg.quantity ?? "0"),
        costUsd: moneyString(legCost),
        proceedsUsd: moneyString(legProceeds),
      }),
    );
  }

  const allocation = allocations[0];
  if (!allocation) {
    throw new Error("要有分配");
  }
  return { trade, allocation, allocations };
}
