# Task: Mermaid Diagram Templates

## 1. Task Metadata

- **Task name:** Mermaid Diagram Templates
- **Slug:** mermaid-templates
- **Status:** planned
- **Created:** 2025-11-29
- **Last updated:** 2025-11-29
- **Shipped:** _(pending)_

---

## 2. Context & Problem

**Current state:**
- Users must write Mermaid syntax from scratch every time
- No built-in examples or starting points for common diagram types
- Beginners face steep learning curve memorizing syntax for different diagram types

**Pain points:**
- **Barrier to entry:** New users don't know Mermaid syntax—empty code block is intimidating
- **Slow creation:** Even experienced users copy-paste from old docs or web examples
- **Discoverability:** Users may not know Mermaid supports gantt charts, ER diagrams, pie charts, etc.
- **User need:** Built-in templates for all chart types accelerate diagram creation

**Why it matters:**
- **Reduce friction:** Templates get users to "working diagram" in seconds, not minutes
- **Learning tool:** Seeing pre-filled syntax teaches Mermaid faster than reading docs
- **Showcase features:** Templates demonstrate advanced diagram types users might not discover
- **Value proposition:** Offering templates for free provides immediate value to users

---

## 3. Desired Outcome & Scope

**Success criteria:**
- Users can insert pre-filled Mermaid templates via command palette or toolbar
- Templates cover 8-10 most common diagram types with realistic, useful examples
- Templates include inline comments explaining syntax (educational)
- Inserting a template creates a valid, immediately-renderable diagram
- Works seamlessly with existing Mermaid rendering and split-view editing

**In scope:**
- Template library for these diagram types:
  1. **Flowchart** (graph TD) - decision trees, processes
  2. **Sequence diagram** - API calls, user interactions
  3. **Class diagram** - UML, data models
  4. **State diagram** - state machines, workflows
  5. **Gantt chart** - project timelines
  6. **Pie chart** - data visualization
  7. **ER diagram** - database schemas
  8. **Git graph** - version control flows
- Command palette entry: "Insert Mermaid Template..."
- Quick-pick menu showing template options with previews (text descriptions)
- Insert at cursor position or replace current Mermaid block

**Out of scope:**
- Custom user-defined templates (v2 feature)
- Visual template picker with rendered previews (separate task: template gallery)
- Templates for KaTeX math equations (different feature)
- Export templates to standalone files

---

## 4. UX & Behavior

**Entry points:**
- **Command palette:** `Cmd/Ctrl+Shift+P` → "Speckit for Humans: Insert Mermaid Template"
- **Toolbar button:** New "Templates" dropdown next to Mermaid diagram button (when in diagram block)
- **Context menu:** Right-click in Mermaid code block → "Insert Template..."
- **Keyboard shortcut:** `Ctrl+Shift+T` → opens template picker (when in Mermaid block)

**User flows:**

### Flow 1: Inserting template in new diagram
1. User types ` ```mermaid ` to create empty diagram block
2. User presses `Ctrl+Shift+T` or clicks "Templates" button
3. Quick-pick menu appears with template options:
   ```
   > Flowchart (Decision Tree)
     Sequence Diagram (API Call)
     Class Diagram (UML)
     State Diagram (Workflow)
     Gantt Chart (Project Timeline)
     Pie Chart (Data Distribution)
     ER Diagram (Database Schema)
     Git Graph (Version Control)
   ```
4. User selects "Flowchart (Decision Tree)"
5. Template content replaces placeholder:
   ```mermaid
   graph TD
       Start[Start Process] --> Input[User Input]
       Input --> Decision{Valid?}
       Decision -->|Yes| Process[Process Data]
       Decision -->|No| Error[Show Error]
       Process --> End[Complete]
       Error --> Input
   ```
6. Diagram renders immediately, user can modify as needed

### Flow 2: Replacing existing diagram with template
1. User has existing Mermaid diagram in document
2. User clicks into the diagram code (enters edit mode)
3. User opens template picker via command palette
4. Quick-pick shows templates + confirmation prompt:
   - "Replace current diagram with template?"
   - [Yes] [No]
5. User confirms → current content replaced with template
6. Diagram re-renders with new template

### Flow 3: Learning from template comments
1. User inserts "Sequence Diagram" template
2. Template includes inline comments:
   ```mermaid
   sequenceDiagram
       participant User
       participant API
       participant DB

       %% User initiates request
       User->>API: GET /data

       %% API processes and queries database
       API->>DB: SELECT * FROM users
       DB-->>API: Return results

       %% API responds to user
       API-->>User: 200 OK + JSON
   ```
3. User sees comments explaining each section
4. User modifies template for their use case, learning syntax in context

**Behavior rules:**
- **Smart insertion:** If cursor is in empty Mermaid block, replace placeholder. If block has content, prompt for confirmation.
- **Cursor positioning:** After template insertion, cursor moves to first editable section (e.g., after "Start" node in flowchart)
- **Render immediately:** Template insertion triggers diagram render (via existing Mermaid extension)
- **Undo-friendly:** Template insertion is single undo operation (Ctrl+Z restores previous content)
- **Accessible:** Templates described clearly for screen readers ("Flowchart template with 5 nodes and 6 edges")

**Template content guidelines:**
- **Realistic examples:** Use real-world scenarios (not "A → B → C")
- **Educational comments:** Explain syntax for complex parts
- **Complete & valid:** Every template must render without errors
- **Concise:** 10-20 lines max, demonstrating core features without overwhelming

---

## 5. Technical Plan

_(To be filled during task refinement)_

---

## 6. Work Breakdown

_(To be filled during task refinement)_

---

## 7. Implementation Log

_(To be filled during implementation)_

---

## 8. Decisions & Tradeoffs

_(To be filled during implementation)_

---

## 9. Follow-up & Future Work

- Visual template gallery with rendered previews (task-mermaid-template-gallery.md)
- User-defined custom templates stored in workspace settings
- Template variables/placeholders (e.g., `{{PROJECT_NAME}}` auto-replaced)
- Community template marketplace
- Templates for other extensions (KaTeX formulas, table layouts)
