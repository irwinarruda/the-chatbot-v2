import { GetCurrentDateTimeToolDTO } from "~/contracts/tools/chat/get-current-date-time";
import type { RegisteredTool } from "~/server/modules/chat/services/tool-executor.service";

const currentTimeZone = "America/Sao_Paulo";
const currentDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: currentTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function createChatTools(
  clock: () => Date = () => new Date(),
): RegisteredTool[] {
  return [
    {
      name: "get_current_datetime",
      description: [
        "Return the current date and time for the user's time zone.",
        "Call this first and wait for its result before interpreting a current or relative date or time.",
        "Use it for expressions such as today, tomorrow, next Friday, one month from now, or a date without a year.",
        "Do not use it when the user provides a complete absolute date.",
        "Returns { currentDate, currentDateTimeUtc, timeZone }.",
      ].join("\n"),
      inputSchema: GetCurrentDateTimeToolDTO,
      mutating: false,
      run: async (args) => {
        GetCurrentDateTimeToolDTO.parse(args);
        const now = clock();
        return {
          currentDate: currentDateFormatter.format(now),
          currentDateTimeUtc: now.toISOString(),
          timeZone: currentTimeZone,
        };
      },
    },
  ];
}
