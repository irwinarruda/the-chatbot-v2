import { AssistantTextParser } from "~/server/utils/AssistantTextParser";
import { MessageContentType } from "~/shared/entities/enums/MessageContentType";

describe("AssistantTextParser", () => {
  test("parses a well-formed text response", () => {
    expect(AssistantTextParser.parse("[Text]Hello there")).toEqual({
      type: MessageContentType.Text,
      text: "Hello there",
    });
  });

  test("parses a well-formed button response", () => {
    expect(
      AssistantTextParser.parse("[Button][Confirm;Cancel]Are you sure?"),
    ).toEqual({
      type: MessageContentType.Button,
      text: "Are you sure?",
      options: ["Confirm", "Cancel"],
    });
  });

  test("keeps plain responses without a prefix untouched", () => {
    expect(AssistantTextParser.parse("just plain text")).toEqual({
      type: MessageContentType.Text,
      text: "just plain text",
    });
    expect(AssistantTextParser.parse("")).toEqual({
      type: MessageContentType.Text,
      text: "",
    });
  });

  test("strips a [Text] marker that landed mid-sentence", () => {
    expect(
      AssistantTextParser.parse("Sure! [Text]Here is your balance."),
    ).toEqual({
      type: MessageContentType.Text,
      text: "Sure! Here is your balance.",
    });
  });

  test("recognizes a button directive that landed mid-sentence", () => {
    expect(
      AssistantTextParser.parse("Pick one [Button][Yes;No] before we continue"),
    ).toEqual({
      type: MessageContentType.Button,
      text: "Pick one before we continue",
      options: ["Yes", "No"],
    });
  });

  test("strips duplicated prefixes and lone markers", () => {
    expect(AssistantTextParser.parse("[Text][Text]Hi [Text]again")).toEqual({
      type: MessageContentType.Text,
      text: "Hi again",
    });
    expect(AssistantTextParser.parse("[Button]No options here")).toEqual({
      type: MessageContentType.Text,
      text: "No options here",
    });
  });

  test("caps buttons at three and drops empty labels", () => {
    expect(AssistantTextParser.parse("[Button][A;;B;C;D]Choose")).toEqual({
      type: MessageContentType.Button,
      text: "Choose",
      options: ["A", "B", "C"],
    });
  });
});
