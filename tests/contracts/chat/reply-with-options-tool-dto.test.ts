import { ReplyWithOptionsToolDTO } from "~/contracts/tools/chat/reply-with-options";

describe("ReplyWithOptionsToolDTO", () => {
  test("accepts a message with up to three button labels of at most 20 characters", () => {
    expect(
      ReplyWithOptionsToolDTO.parse({
        message: " Quer marcar a Academia como paga? ",
        options: ["Sim", "Não", "Não, deixar pendente"],
      }),
    ).toEqual({
      message: "Quer marcar a Academia como paga?",
      options: ["Sim", "Não", "Não, deixar pendente"],
    });
  });

  test("rejects a button label over the 20 characters WhatsApp accepts", () => {
    expect(() =>
      ReplyWithOptionsToolDTO.parse({
        message: "Quer marcar a Academia como paga?",
        options: ["Sim, marcar como paga", "Não"],
      }),
    ).toThrow("A button label has at most 20 characters");
  });

  test("rejects no options and more than three options", () => {
    expect(() =>
      ReplyWithOptionsToolDTO.parse({ message: "Escolha", options: [] }),
    ).toThrow();
    expect(() =>
      ReplyWithOptionsToolDTO.parse({
        message: "Escolha",
        options: ["A", "B", "C", "D"],
      }),
    ).toThrow();
  });
});
