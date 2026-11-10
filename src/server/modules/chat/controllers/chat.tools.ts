import { GetCurrentDateTimeToolDTO } from "~/contracts/tools/chat/get-current-date-time";
import {
  ReplyWithOptionsToolDTO,
  replyWithOptionsToolName,
} from "~/contracts/tools/chat/reply-with-options";
import { ValidationException } from "~/domain/shared/domain-errors";
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
    {
      name: replyWithOptionsToolName,
      description: [
        "Send your final reply as one WhatsApp message with tappable buttons under it.",
        "`message` is the whole message body and each entry of `options` becomes one button.",
        "Call it alone, after every other tool has finished. Text written outside this call is delivered as a separate message before the buttons, so the user reads the reply twice. Put everything you want to say inside `message`.",
        'WhatsApp refuses the whole message when a button label is longer than 20 characters. Keep each label to 1 to 3 short words, such as "Sim", "Não", "Confirmar" or "Cancelar".',
      ].join("\n"),
      inputSchema: ReplyWithOptionsToolDTO,
      mutating: false,
      run: async (args) => {
        ReplyWithOptionsToolDTO.parse(args);
        throw new ValidationException(
          `The options were not sent because ${replyWithOptionsToolName} was called together with other tools. Call it again alone, after their results.`,
        );
      },
    },
  ];
}
