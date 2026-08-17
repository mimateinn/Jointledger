import { isPositive, money, moneyString } from "./money";
import type { LedgerStore } from "./store";
import type { AllocationLeg, AllocationSchedule, SetAllocationScheduleInput } from "./types";

export async function setAllocationSchedule(
  store: LedgerStore,
  input: SetAllocationScheduleInput,
): Promise<{ schedule: AllocationSchedule; legs: AllocationLeg[] }> {
  if (!input.effectiveOn.trim()) {
    throw new Error("要寫生效日");
  }
  if (input.legs.length === 0) {
    throw new Error("要有分配");
  }

  const schedule = await store.insertAllocationSchedule({
    bookId: input.bookId,
    effectiveOn: input.effectiveOn,
  });

  const legs: AllocationLeg[] = [];
  for (const leg of input.legs) {
    if (!isPositive(leg.percent)) {
      throw new Error("分配必須大於 0");
    }
    legs.push(
      await store.insertAllocationLeg({
        scheduleId: schedule.id,
        memberId: leg.memberId,
        percent: moneyString(money(leg.percent)),
      }),
    );
  }

  return { schedule, legs };
}

export function scheduleInForce<T extends { effectiveOn: string }>(
  schedules: T[],
  onDate: string,
): T | null {
  const eligible = schedules
    .filter((row) => row.effectiveOn <= onDate)
    .sort((a, b) => a.effectiveOn.localeCompare(b.effectiveOn));
  return eligible.at(-1) ?? null;
}
