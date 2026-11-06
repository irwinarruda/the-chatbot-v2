# UI/UX council: calibration

You are one judge on a council of independent reviewers. The user picked the apps below as examples of UI and UX they admire. The council grades them first, so later rounds can compare the user's own app against them on the same scale. Other judges grade the same apps; you will not see their verdicts.

Open only this brief and the images it lists. Never open, list or search for any other file, including other judges' verdicts. Do not browse the web. Do not edit any file except your verdict file.

## How to look

Open every image listed below with your image-viewing tool. Look at each one before you grade anything. If you cannot view images, write a verdict with `"viewed_images": false` and an empty `modules` array, then stop. Never guess from file names.

## Scale

| Score | Meaning |
|---|---|
| 10 | Exemplary. Nothing you would change. |
| 9 | Excellent. Best-in-class; only nitpicks remain. |
| 8 | Very good. Polished, with a few issues a careful user would notice. |
| 7 | Good. Solid, with clear inconsistencies or friction. |
| 5–6 | Adequate. Works, but looks generic or uneven. |
| 3–4 | Weak. Confusing or visually broken in places. |
| 1–2 | Broken. |

Use one decimal place when a whole number would be wrong. The user admiring an app does not make it a 10. Grade what you see.

## Criteria

- **ui**: Visual design: hierarchy, typography, spacing and alignment, color and contrast, consistency between screens, polish of details (icons, borders, shadows, empty space), and how it holds up on mobile.
- **ux**: Experience: how obvious the purpose and next action are, navigation and wayfinding, information density, feedback and states (loading, empty, error, success), form and interaction friction, accessibility signals (contrast, target size, labels), and responsive behavior.

## Apps to grade

Each app below is one entry in `modules`.

### t3-code

What the user likes about it: Main inspiration (user's own words: inspirations are apps like T3 Code, Codex and Claude Code). Screens: new thread, usage limits, settings. The Chatbot is more than a chat app (chat, todos, notes, artifacts, cash flow, monthly bills), so take the base from these apps: their beauty, how easy the screens are to read, and how coherent they are with each other, not just the chat idea. Must work in both dark and light mode.

- /home/arrud/Documents/PRO/the-chatbot-v2/.ui-council/references/t3-code/new-thread.png
- /home/arrud/Documents/PRO/the-chatbot-v2/.ui-council/references/t3-code/settings.png
- /home/arrud/Documents/PRO/the-chatbot-v2/.ui-council/references/t3-code/usage-limits.png

### codex

What the user likes about it: Main inspiration (Codex desktop app). Screens: a conversation and an images gallery. The Chatbot is more than a chat app (chat, todos, notes, artifacts, cash flow, monthly bills), so take the base from these apps: their beauty, how easy the screens are to read, and how coherent they are with each other, not just the chat idea. Must work in both dark and light mode.

- /home/arrud/Documents/PRO/the-chatbot-v2/.ui-council/references/codex/conversation.png
- /home/arrud/Documents/PRO/the-chatbot-v2/.ui-council/references/codex/images-gallery.png

### claude-code

What the user likes about it: Main inspiration (Claude Code desktop app): a conversation with a side panel. The Chatbot is more than a chat app (chat, todos, notes, artifacts, cash flow, monthly bills), so take the base from these apps: their beauty, how easy the screens are to read, and how coherent they are with each other, not just the chat idea. Must work in both dark and light mode.

- /home/arrud/Documents/PRO/the-chatbot-v2/.ui-council/references/claude-code/conversation-with-panel.png

### linear

What the user likes about it: User: 'Linear is a good reference too.' Screen: an issue with an agent panel. The Chatbot is more than a chat app (chat, todos, notes, artifacts, cash flow, monthly bills), so take the base from these apps: their beauty, how easy the screens are to read, and how coherent they are with each other, not just the chat idea. Must work in both dark and light mode.

- /home/arrud/Documents/PRO/the-chatbot-v2/.ui-council/references/linear/issue-with-agent.png

## Verdict

Write this JSON to `/home/arrud/Documents/PRO/the-chatbot-v2/.ui-council/references/verdicts/<your judge id>.json` (create the folder if needed):

```json
{
  "judge": "<your judge id>",
  "viewed_images": true,
  "modules": [
    {
      "module": "<app name, exactly as listed>",
      "scores": { "ui": <1-10>, "ux": <1-10> },
      "strengths": ["<up to 5 transferable principles: what this app does that another app could copy>"],
      "issues": [
        {
          "severity": "high | medium | low",
          "criterion": "<one of: ui, ux>",
          "screen": "<image file name>",
          "problem": "<what keeps it from a higher score>",
          "fix": "<what would solve it>"
        }
      ]
    }
  ],
  "overall": "<what these apps have in common that makes them good>"
}
```

Then reply with one line: the verdict path.
