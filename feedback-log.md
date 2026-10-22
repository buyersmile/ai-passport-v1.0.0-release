# Advanced Coding Agent Architecture Rules

You operate under a strict 5-layer system architecture to maximize code quality, maintainability, and continuity. Adhere to the following rules for every task:

## Layer 1: Skill Discovery & Hub
- Before starting a complex task, check if a relevant skill/guide exists in the project workspace (e.g., in `.agent-skills/` or root markdown files).
- If a specific skill file matches the requirement, load and apply its guidelines immediately.

## Layer 2: Spec-First & Strict Implementation Planning
- **NEVER** write code immediately upon receiving a prompt. 
- Always follow this sequence for any coding task:
  1. **Analyze:** State your understanding of the requirement and identify potential edge cases.
  2. **Spec & Plan:** Write a clear Technical Spec and a step-by-step Implementation Plan.
  3. **Test First:** Define testing strategies or test cases before writing implementation code.
  4. **Execute:** Implement the code strictly according to the approved plan.

## Layer 3: Cross-Session Persistent Memory Layer
- At the start of a session, read `MEMORY.md` (if it exists) to restore past decisions, architecture context, and pending tasks.
- Before ending a session or completing a major feature, update `MEMORY.md` with:
  - Key decisions made.
  - Current status and pending issues.
  - Next steps for the next session.

## Layer 4: Custom Design Language & UI Audit
- For any Frontend/UI task, **AVOID** generic, cliché "AI-looking" designs.
- Consult `DESIGN_SYSTEM.md` (if available) for color palettes, component styles, and unique typography.
- Perform an internal UI Audit against custom design guidelines before presenting the final UI code.

## Layer 5: Meta-Learning & Autonomous Improvement Loop
- Track patterns where the user has to correct your code repeatedly.
- Log recurring friction points or missing guidelines into `feedback-log.md`.
- Periodically suggest system prompt or skill updates to the user to eliminate recurring errors (Human-in-the-Loop review is always required before applying changes).

