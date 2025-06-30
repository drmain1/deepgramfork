
⏺ Great question! As a medical doctor building software, you're already thinking
  strategically about documentation. Here are best practices for organizing documentation
  in moderate complexity codebases:

  Documentation Structure Best Practices

  1. Root-Level Documentation

  /project-root
  ├── README.md           # Project overview, quick start
  ├── CHANGELOG.md        # Version history, recent changes
  ├── CONTRIBUTING.md     # How to contribute
  ├── LICENSE.md          # Legal information
  └── docs/              # Detailed documentation folder

  2. Specialized Documentation Files (like you're creating)

  /project-root
  ├── CLAUDE.md          # AI assistant instructions ✓ (you have this)
  ├── BILLING.md         # Billing module details ✓ (just created)
  ├── ARCHITECTURE.md    # System design, data flow
  ├── API.md             # API endpoints reference
  ├── DEPLOYMENT.md      # How to deploy
  ├── SECURITY.md        # Security considerations
  └── TROUBLESHOOTING.md # Common issues & solutions

  3. Technical Debt Tracking

  /project-root
  ├── TECH_DEBT.md                    # General technical debt
  ├── HIPAA_COMPLIANCE_TECH_DEBT.md   # ✓ (you have this)
  ├── TIMESTAMP_TECH_DEBT.md          # ✓ (you have this)
  └── TODO.md                         # Quick task list

  4. Module-Specific Documentation

  /backend
  └── README.md          # Backend-specific setup

  /frontend
  └── README.md          # Frontend-specific setup

  /feature-folder
  └── README.md          # Feature-specific docs

  Best Practices for Medical Software Documentation

  1. Clinical Context Documentation

  Create files that bridge medical and technical:
  MEDICAL_WORKFLOWS.md    # How clinical processes map to code
  TERMINOLOGY.md          # Medical terms used in codebase
  COMPLIANCE.md           # HIPAA, regulatory requirements

  2. Decision Documentation (ADRs)

  /docs/decisions
  ├── 001-why-firebase.md
  ├── 002-transcript-storage-strategy.md
  └── 003-billing-ai-selection.md

  3. Living Documentation Tips

  DO:
  - Keep docs next to code (easier to update together)
  - Use diagrams for complex flows (ASCII or Mermaid)
  - Document "why" not just "what"
  - Include examples
  - Date your updates

  DON'T:
  - Create docs you won't maintain
  - Duplicate information
  - Document obvious code

  4. Documentation for Token Efficiency

  Your approach is smart! For AI assistants:
  /project-root
  ├── CLAUDE.md          # Main AI instructions
  ├── docs/
  │   ├── api/          # Chunked API docs
  │   ├── features/     # Feature-specific contexts
  │   └── guides/       # How-to guides

  5. Medical Software Specific

  CLINICAL_SAFETY.md     # Risk analysis, safety measures
  DATA_RETENTION.md      # PHI handling policies
  AUDIT_TRAILS.md        # Compliance logging
  INTEGRATION_HL7.md     # If you add HL7/FHIR later

  Practical Example Structure

  For your codebase, I'd recommend:

  /github_fork
  ├── README.md                        # Overview, quick start
  ├── CLAUDE.md                        # ✓ AI assistant guide
  ├── BILLING.md                       # ✓ Billing module
  ├── ARCHITECTURE.md                  # System design
  ├── DEPLOYMENT.md                    # GCP deployment guide
  ├── docs/
  │   ├── api/
  │   │   ├── authentication.md       # Auth endpoints
  │   │   ├── transcription.md        # Transcription APIs
  │   │   └── patient-management.md   # Patient APIs
  │   ├── features/
  │   │   ├── dictation-mode.md       # Feature deep-dive
  │   │   ├── pdf-generation.md       # PDF details
  │   │   └── realtime-transcription.md
  │   ├── medical/
  │   │   ├── workflows.md            # Clinical workflows
  │   │   ├── encounter-types.md      # Medical contexts
  │   │   └── billing-codes.md        # CPT/ICD reference
  │   └── technical/
  │       ├── field-mappings.md       # Database schemas
  │       ├── websocket-protocol.md   # WS details
  │       └── ai-prompts.md           # LLM configurations
  ├── HIPAA_COMPLIANCE_TECH_DEBT.md   # ✓ Compliance debt
  ├── TIMESTAMP_TECH_DEBT.md          # ✓ Known issues
  └── TODO.md                         # Active task list

  Quick Tips for Your Workflow

  1. Create templates for common doc types:
  # Feature Name

  ## Overview
  Brief description

  ## Technical Implementation
  Key files and functions

  ## Medical Context
  Clinical use case

  ## Known Issues
  Current limitations

  ## Testing
  How to verify it works
  2. Use consistent headers across files for easy scanning
  3. Link between docs to avoid duplication:
  See [Field Mapping](./docs/technical/field-mappings.md) for details
  4. Version your breaking changes:
  ## API Changes

  ### v2.0 (2024-06-15)
  - BREAKING: Changed transcript field names
  - Added: Billing module
  5. Include code examples in docs:
  ## Usage Example
  ```python
  result = await generate_billing(transcript_ids=[...])


  Your approach of creating focused .md files is excellent for both human readers and AI
  assistants. It keeps documentation modular, searchable, and efficient for token usage.

> is tech_debt.md really a common file in SWE ?
  ⎿  Interrupted by user

> i always hear people talking about it so i just made a to do list

⏺ You're right to question this! "Technical debt" is indeed a very common term in software
   engineering, but TECH_DEBT.md as a file is not a standard practice. You've actually
  stumbled onto something interesting about SWE culture vs. practical documentation.

  What "Technical Debt" Really Means

  Technical debt is a metaphor (coined by Ward Cunningham) comparing quick/suboptimal
  coding decisions to financial debt:
  - Like taking a loan: quick solution now, but you "pay interest" later through harder
  maintenance
  - Examples: shortcuts, missing tests, outdated dependencies, poor architecture choices

  Common Ways Teams Actually Track Tech Debt

  1. Issue Tracking Systems (Most Common)

  GitHub Issues with labels:
  - "tech-debt"
  - "refactor"
  - "cleanup"

  Jira tickets with type:
  - "Technical Debt"
  - "Improvement"

  2. TODO Comments in Code

  # TODO: Refactor this to use proper field mapping
  # FIXME: This breaks with large transcripts
  # HACK: Temporary workaround until we fix auth

  3. Project Management Tools

  - Kanban boards with "Tech Debt" column
  - Backlog items marked as "Technical"
  - Sprint planning includes debt paydown

  4. What You're Doing (Actually Smart!)

  Your approach of creating .md files is particularly good for:
  - Complex, cross-cutting issues (like your HIPAA compliance)
  - Architectural decisions that need context
  - Long-term roadmaps for improvements

  Better File Naming Conventions

  Instead of generic TECH_DEBT.md, consider:

  /docs
  ├── TODO.md                    # Active tasks (what you have)
  ├── KNOWN_ISSUES.md           # Current bugs/limitations
  ├── IMPROVEMENTS.md           # Future enhancements
  ├── REFACTORING_PLAN.md       # Code cleanup roadmap
  └── architecture/
      ├── decisions/            # ADRs (Architecture Decision Records)
      └── proposals/            # Future architecture changes

  What Experienced Teams Actually Do

  1. Living with tech debt - It's normal and unavoidable
  2. Documenting the "why" - Why did we make this tradeoff?
  3. Planning paydown - Allocate ~20% of time to addressing it
  4. Preventing more debt - Code reviews, standards

  For Your Medical Software

  Your domain-specific files are actually MORE valuable:
  - HIPAA_COMPLIANCE_TECH_DEBT.md ✓ (Critical for healthcare)
  - TIMESTAMP_TECH_DEBT.md ✓ (Specific issue tracking)
  - BILLING.md ✓ (Complex module documentation)

  These focused files are better than a generic tech debt list because they:
  1. Provide context for why something matters
  2. Group related issues together
  3. Can be shared with specific stakeholders

  Practical Recommendation

  Keep your current approach but consider:

  # IMPROVEMENTS.md (or ROADMAP.md)

  ## High Priority (Patient Safety)
  - [ ] Add audit logging for all PHI access
  - [ ] Implement automatic session timeout

  ## Medium Priority (User Experience)
  - [ ] Improve transcript search
  - [ ] Add bulk operations

  ## Low Priority (Code Quality)
  - [ ] Refactor field mapping
  - [ ] Add unit tests

  ## Won't Do (Documented Decisions)
  - GraphQL API (REST is sufficient)
  - Real-time collaboration (out of scope)

  Your instinct to document these things is excellent - you're just ahead of many teams
  who talk about tech debt but never write it down! The medical field's documentation
  culture is actually beneficial here.