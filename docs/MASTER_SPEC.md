AI MARKETING OS

FINAL MASTER BUILD SPECIFICATION V3

Production-Grade AI Marketing Command Center

---

1. PRODUCT MISSION

Build a production-grade, AI-native Marketing Operating System that helps businesses, creators, agencies and personal brands manage the complete marketing lifecycle:

Understand → Research → Strategize → Create → Review → Publish → Measure → Learn → Improve

The product must not behave like a simple AI content generator.

It must behave like an AI Marketing Command Center that understands a business and continuously improves its marketing system.

The user's default experience should be:

Connect → Tell us about your business → AI understands → AI plans → AI creates → AI checks → User approves → AI publishes → AI analyzes → AI learns

The system should minimize manual work while keeping users in control.

---

2. PRODUCT NORTH STAR

The primary product value is:

«Save the user's time while improving marketing quality and decision-making.»

The product should optimize for:

- Business outcomes
- Quality
- Consistency
- Time saved
- Marketing intelligence
- Learning from performance
- Sustainable growth

It must NOT optimize merely for:

- Maximum number of posts
- Maximum AI generations
- Artificial engagement
- Spam
- Guaranteed virality

Never promise viral results.

---

3. TARGET USERS

The architecture must support almost any legitimate business or creator category.

Examples:

- Content creators
- Influencers
- Personal brands
- SaaS
- IT companies
- Startups
- E-commerce
- Clothing brands
- Food businesses
- Local businesses
- Education
- Coaches
- Consultants
- Agencies
- Product businesses
- Service businesses
- Animation/cartoon creators
- Faceless creators
- YouTube creators
- Social media brands

The AI must adapt strategy based on the user's actual business context.

---

4. PRODUCT PRINCIPLES

4.1 AI-first, manual-optional

Users should not be forced through complicated forms.

AI should recommend sensible defaults.

Advanced controls should remain available for power users.

4.2 Progressive disclosure

Default:

AI Recommended

Advanced:

Customize

Users should not need to understand technical concepts.

4.3 Quality before quantity

Every generated asset must pass appropriate quality checks.

4.4 Human control

AI should recommend and execute, but users must be able to review and approve important actions.

4.5 No fake data

Never display fabricated analytics, revenue, followers, performance or growth.

If data does not exist, clearly show that data is unavailable.

---

5. CORE SYSTEM ARCHITECTURE

                        AI MARKETING OS
                              |
                    ┌─────────┴─────────┐
                    |                   |
              Next.js Web App       Realtime UI
                    |
              NestJS Application API
                    |
      ┌─────────────┼─────────────┐
      |             |             |
 PostgreSQL       Redis        Object Storage
  + Prisma       BullMQ          S3/R2
      |             |
      |        Background Jobs
      |             |
      |      ┌──────┼────────┐
      |      |      |        |
      |    AI Jobs Video   Analytics
      |   Workers Workers  Workers
      |      |      |        |
      |      └──────┼────────┘
      |             |
      |       Model Router
      |             |
      |    ┌────────┼────────┐
      |    |        |        |
     LLM  Image    Video    Voice
 Providers Providers Providers Providers
                    |
                  FFmpeg
                    |
              Rendered Media
                    |
              Publish Workers
                    |
       Instagram / Facebook / YouTube
       X / LinkedIn / Telegram / Pinterest
       TikTok where officially supported

---

6. TECHNOLOGY STACK — FINAL

Use production-appropriate technologies rather than selecting tools merely because they are familiar.

Frontend

- Next.js
- React
- TypeScript
- Server/client rendering where appropriate
- Custom design system
- Vanilla CSS
- Accessible component architecture

Do not default to a generic AI-generated Tailwind dashboard.

Backend

- Node.js
- TypeScript
- NestJS

NestJS is the primary application backend.

Do NOT put the entire backend into Next.js API routes.

Database

- PostgreSQL
- Prisma ORM

PostgreSQL is the primary transactional database and initial analytics database.

Cache / Jobs

- Redis
- BullMQ

Use queues for:

- AI generation
- Video generation
- Rendering
- Publishing
- Analytics synchronization
- Scheduled jobs
- Notifications
- Heavy processing

AI / Data Workers

Use Python where it provides an advantage for:

- AI/data processing
- ML workflows
- advanced media processing
- analytics processing
- specialized AI workers

Use TypeScript for application orchestration.

TypeScript = Product/Application Brain

Python = AI/Data/Processing Workers

AI Architecture

Provider-agnostic model router.

Do not hard-code the entire application to one AI provider.

Video

- FFmpeg
- Dedicated rendering workers
- GPU-capable workers where required
- Multiple resolution output
- Thumbnail generation
- Audio normalization
- Caption rendering

Video rendering must not depend on the user's browser.

Storage

S3-compatible object storage and/or Cloudflare R2.

Store:

- Uploaded assets
- Generated images
- Audio
- Video renders
- Thumbnails
- Render versions
- Exported files

CDN / Edge

Cloudflare or equivalent CDN/edge infrastructure.

Realtime

- WebSockets and/or SSE

Use for:

- Generation progress
- Rendering progress
- Publishing status
- Notifications
- Job status
- Dashboard live updates

Search

Start with:

- PostgreSQL Full Text Search

Add a dedicated search engine only when real scale requires it.

Do not introduce Elasticsearch/OpenSearch on day one unnecessarily.

Observability

- OpenTelemetry
- Error tracking
- Performance monitoring
- Structured logging
- Metrics
- Distributed tracing where needed

Payments

- Stripe

Support:

- subscriptions
- upgrades/downgrades
- cancellations
- invoices
- credits
- refunds
- webhook processing

Deployment

- Docker
- Managed cloud infrastructure
- GitHub Actions CI/CD

Do not introduce Kubernetes, Kafka or other high-complexity infrastructure unless actual scale justifies it.

---

7. MULTI-TENANT ARCHITECTURE

Support:

- Users
- Organizations
- Workspaces
- Teams

Every tenant-owned resource must have proper organization/workspace ownership.

Tenant isolation must be enforced at the backend/database access layer.

Never trust organization IDs supplied by the client.

---

8. ROLES AND PERMISSIONS

Support roles such as:

- Owner
- Admin
- Editor
- Creator
- Analyst
- Client

Permissions should control:

- Content creation
- Publishing
- Billing
- Analytics
- Team management
- Brand settings
- Integrations
- AI usage
- Admin operations

---

9. AUTHENTICATION

Implement real authentication.

Required:

- Registration
- Login
- Logout
- Refresh tokens/session renewal
- Password reset
- Email verification where appropriate
- Secure password hashing
- Session management
- Token rotation
- Rate limiting

Optional/architecture-ready:

- MFA
- Social login
- SSO

Authentication must be tested end-to-end.

---

10. ONBOARDING

The onboarding system must collect enough information for the AI to understand the business.

Collect:

- Business/brand name
- Business type
- Industry
- Products/services
- Product details
- Pricing
- Offers
- Target audience
- Customer problems
- Customer needs
- Location/market
- Languages
- USP
- Competitors
- Brand tone
- Brand personality
- Marketing goals
- Platforms
- Website
- Social profiles
- Logo
- Brand colors
- Fonts
- Images
- Videos
- Other assets

Goals can include:

- Reach
- Followers
- Engagement
- Leads
- Website traffic
- Sales
- Awareness
- Community growth

AI should use onboarding data to automatically create the initial marketing foundation.

---

11. BRAND BRAIN

Create a persistent Brand Brain / Marketing Digital Twin.

It should understand relationships between:

Business
 ↓
Products
 ↓
Customers
 ↓
Problems
 ↓
Benefits
 ↓
USP
 ↓
Competitors
 ↓
Topics
 ↓
Offers
 ↓
Content
 ↓
Results
 ↓
Learnings

The Brand Brain must persist across sessions.

AI should not repeatedly ask the user for information it already knows.

---

12. CREATIVE DNA

Maintain a separate Creative DNA layer containing:

- Brand voice
- Vocabulary
- Tone
- Humor style
- Storytelling style
- Visual identity
- Typography
- Color rules
- Editing style
- Pacing
- Music preferences
- Caption style
- Thumbnail style
- Hook style
- CTA style

The system should learn from approved content.

---

13. AI AGENT SYSTEM

Use an orchestrated multi-agent architecture.

Core agents:

1. Chief Marketing Orchestrator
2. Research Agent
3. Brand Agent
4. Audience Agent
5. Strategy Agent
6. Content Ideation Agent
7. Script Agent
8. Creative Director
9. Video Director
10. Editor Agent
11. SEO Agent
12. AEO/AI Search Agent
13. Localization Agent
14. Publishing Agent
15. Analytics Agent
16. Growth Agent
17. Compliance/Safety Agent
18. Community Intelligence Agent

Agents should not operate as isolated chatbots.

The Orchestrator coordinates tasks, context and outputs.

---

14. MODEL ROUTER

Implement a centralized Model Router.

It must select models based on:

- Task complexity
- Quality requirement
- Latency
- Cost
- Input/output type
- Availability
- Provider health
- User plan
- Credits
- Required capabilities

Example:

Simple classification
→ fast/low-cost model

Strategy/reasoning
→ advanced reasoning model

Image generation
→ specialized image model

Video
→ specialized video provider

Voice
→ specialized voice provider

Embeddings
→ embedding model

The provider should be replaceable without rewriting business logic.

Track:

- Provider
- Model
- Tokens
- Cost
- Latency
- Success/failure
- Retry count
- Quality metadata

---

15. PROVIDER FALLBACK

Support:

Primary Provider
      ↓ failure
Fallback Provider A
      ↓ failure
Fallback Provider B

Fallback must respect:

- Capability compatibility
- Quality requirements
- Cost limits
- User plan
- Provider availability

Never silently downgrade quality for critical output without recording the event.

---

16. DEV / STAGING / PRODUCTION

Separate environments:

- Development
- Staging
- Production

Never mix production secrets with development.

Use environment variables and secure secret management.

---

17. MARKETING STRATEGY ENGINE

The system must create actual marketing strategy.

It should determine:

- Marketing goals
- Audience
- Content pillars
- Campaigns
- Topics
- Formats
- Hooks
- CTAs
- Platforms
- Posting schedule
- Campaign duration
- Offers
- Experiments

The AI should explain important recommendations where useful.

---

18. RESEARCH ENGINE

Research should support:

- Industry trends
- Audience interests
- Competitors
- Content gaps
- Questions
- Pain points
- Search demand
- Seasonal opportunities
- Market opportunities

Research results should become structured knowledge that can feed the strategy engine.

---

19. TREND INTELLIGENCE

Track relevant trends where data/API access permits.

The system must distinguish:

- Current trend
- Historical trend
- Evergreen topic
- Emerging topic
- Expired trend

Never present stale information as current.

---

20. COMPETITOR INTELLIGENCE

Analyze publicly available/authorized data such as:

- Content themes
- Formats
- Posting patterns
- Engagement indicators
- Topics
- Hooks
- Positioning

Do not copy competitors.

Use competitor intelligence to identify opportunities and differentiation.

---

21. SEO + AEO

Support:

- SEO
- Search intent
- Keywords
- Titles
- Descriptions
- Structured content
- FAQ opportunities
- AI-search optimization
- Answer-oriented content

The system should optimize content for both traditional search and AI answer systems where applicable.

---

22. LOCALIZATION

Localization must be more than translation.

Adapt:

- Language
- Cultural references
- Examples
- Humor
- CTA
- Local terminology
- Market context
- Currency
- Time zone
- Seasonal events

---

23. MARKETING CALENDAR INTELLIGENCE

Calendar engine should understand:

- Festivals
- Holidays
- Industry events
- Seasonal demand
- Product launches
- Promotions
- Important dates
- Business-specific events

Generate opportunities relevant to the user's market and business.

---

24. CONTENT IDEATION

AI should generate:

- Content ideas
- Campaign ideas
- Series
- Content pillars
- Hooks
- Formats
- Topics
- CTAs

Every idea should have context such as:

- Goal
- Audience
- Platform
- Format
- Hook
- Expected purpose
- Campaign relationship

---

25. CONTENT GENERATION

Support:

- Short-form video
- Long-form video
- Educational content
- Product showcase
- Storytelling
- UGC-style content
- Ads-style content
- Explainers
- Animation
- Cartoon
- Faceless content
- Founder content
- Personal brand content
- Image posts
- Carousel concepts
- Text content
- Platform-specific formats

---

26. VIDEO PIPELINE

The production pipeline is:

Idea
 ↓
Hook
 ↓
Script
 ↓
Storyboard
 ↓
Scene Plan
 ↓
Visual Generation / Asset Selection
 ↓
Voice
 ↓
Music / SFX
 ↓
Captions
 ↓
Editing
 ↓
Quality Gate
 ↓
Final Render
 ↓
User Approval
 ↓
Publishing

---

27. PRODUCTION-READY SCRIPT

A generated script must contain, where applicable:

- Scene number
- Scene purpose
- Duration
- Voiceover
- Visual description
- On-screen text
- B-roll
- Product/asset
- Camera movement
- Transition
- Music
- SFX
- Caption
- CTA

The script must be directly usable by the production pipeline.

---

28. VIDEO CONTROLS

Users may control:

- Duration
- Scene/frame count
- Scene duration
- Aspect ratio
- Visual style
- Voice
- Language
- Music
- SFX
- CTA
- Asset source

Examples:

- 15 sec
- 30 sec
- 45 sec
- 60 sec
- 90 sec
- Custom

Scene count examples:

- 5
- 8
- 10
- 12
- Custom

These controls are optional.

Default:

«“Create a 30-second Instagram Reel for my product.”»

AI determines appropriate structure automatically.

---

29. VIDEO SCENE ARCHITECTURE

Each scene should be independently addressable.

A scene may contain:

- Visual
- Voiceover
- Text
- Caption
- Asset
- Camera motion
- Transition
- Music/SFX
- Duration
- Scene purpose

Example:

Scene 4
Duration: 3 sec
Visual: Product close-up
Voiceover: ...
Text: ...
Asset: product-image-17
Transition: ...

---

30. TARGETED REGENERATION

Users must be able to request:

«“Scene 4 को 3 seconds का करो.”»

or:

«“Scene 2 की image बदल दो.”»

or:

«“Voice थोड़ा energetic करो.”»

The system should modify only the affected component whenever technically possible.

Do not regenerate the entire video unnecessarily.

This saves:

- Time
- Credits
- API cost
- Processing time

---

31. AI VIDEO EDITOR

The Editor Agent should evaluate:

- Hook strength
- Scene length
- Pacing
- Visual quality
- Caption timing
- Voice energy
- Product timing
- CTA
- Transitions
- Audio balance

It should be able to recommend and execute targeted improvements.

---

32. ASSET INTELLIGENCE

Uploaded assets should be:

- Categorized
- Tagged
- Searchable
- Deduplicated
- Analyzed

Detect where possible:

- Products
- People
- Scenes
- Logos
- Objects
- Backgrounds
- Asset types

AI should recommend existing assets instead of generating duplicates unnecessarily.

---

33. QUALITY GATE

Before approval/publishing, validate:

Brand

- Brand consistency
- Tone
- Visual identity

Content

- Factual accuracy
- Grammar
- Unsupported claims
- CTA correctness

IP

- Copyright/IP risks
- Unauthorized material

Media

- Audio quality
- Video quality
- Caption accuracy
- Resolution
- Aspect ratio

Platform

- Platform requirements
- Metadata
- Content restrictions

Safety

- Brand safety
- Policy risks
- Potential spam/repetition

Failed checks should block or warn depending on severity.

---

34. HUMAN-IN-THE-LOOP MODES

Autopilot

AI makes most decisions automatically.

User mainly reviews and approves.

Assisted

AI recommends important decisions.

User confirms.

Manual / Advanced

Power users can control details.

---

35. CONTENT CALENDAR

Calendar should support:

- Daily
- Weekly
- Monthly
- Campaign view
- Platform view
- Content type view
- Status
- Approval state
- Scheduled time

Calendar should show:

- Draft
- Ready
- Approval required
- Scheduled
- Published
- Failed

---

36. SOCIAL CONNECTIONS

Support official APIs/OAuth wherever available.

Architecture should support:

- Instagram
- Facebook
- YouTube
- X
- LinkedIn
- Telegram
- Pinterest
- TikTok where official API/policy permits

Never depend on unauthorized scraping or prohibited automation.

---

37. PLATFORM VARIANTS

A single content idea should be adaptable into platform-specific variants.

Each variant may have:

- Video dimensions
- Duration
- Caption
- Title
- Description
- Hashtags
- Thumbnail
- CTA
- Metadata

The system should not blindly publish identical content everywhere.

---

38. PUBLISHING ENGINE

Publishing flow:

Content Ready
 ↓
Quality Gate
 ↓
User Approval
 ↓
Platform Validation
 ↓
Schedule
 ↓
Publish Queue
 ↓
Provider API
 ↓
Published / Failed
 ↓
Retry or User Action

Track every publication.

---

39. POSTING-FREQUENCY SAFETY

Do not hard-code a claim that platforms ban users for posting more than a specific number of AI videos.

Instead:

- Recommend reasonable posting frequency
- Detect repetitive content
- Detect duplicate content
- Detect spam-like behavior
- Space scheduled posts
- Monitor platform rules
- Warn users about relevant risks
- Support AI/synthetic-content disclosure requirements where applicable

Example default recommendation:

1–2 AI-heavy videos/day/platform

This is a product safety recommendation, NOT a platform guarantee or universal limit.

Never promise that the system can prevent bans.

---

40. POLICY ENGINE

Platform rules must be represented through a configurable Policy Engine.

It should support:

- Platform rules
- Format rules
- Disclosure requirements
- Rate/frequency guidance
- Content restrictions
- Metadata requirements

Rules must be updateable without rewriting the application.

---

41. ANALYTICS ENGINE

Track, where APIs/data sources provide the metric:

- Views
- Reach
- Likes
- Comments
- Shares
- Saves
- Watch time
- Retention
- Followers
- Subscribers
- Clicks
- CTR
- Engagement
- Posting performance

---

42. ANALYTICS DRILL-DOWN

Users should be able to move:

Overall
 ↓
Campaign
 ↓
Platform
 ↓
Content
 ↓
Individual Post/Video
 ↓
Scene / Hook where available

---

43. REQUIRED DASHBOARD GRAPHS

Include useful visual analytics for:

- Revenue
- Users
- Reach
- Engagement
- Follower growth
- Content performance
- AI/API spend
- Credits consumed
- Time saved
- Growth trends
- Campaign performance
- Platform performance
- Audience analytics
- Conversion/revenue
- A/B experiments
- Calendar performance
- System/admin health

Only display a graph when actual data exists.

---

44. CONTENT INTELLIGENCE

AI should determine:

- Which topics work
- Which hooks work
- Which formats work
- Which durations work
- Which posting times work
- Which platforms work
- Which CTAs work
- Which creative styles work

It should convert these observations into future recommendations.

---

45. EXPERIMENTATION / A-B TESTING

Support experiments such as:

- Hook A vs Hook B
- 30 sec vs 45 sec
- Story vs Education
- Thumbnail A vs B
- CTA A vs B
- Visual style A vs B

Track experiment results.

Do not declare statistical conclusions when sample size/data is insufficient.

---

46. GROWTH LOOP

Core intelligence loop:

Create
 ↓
Publish
 ↓
Measure
 ↓
Analyze
 ↓
Learn
 ↓
Improve Strategy
 ↓
Generate Better Content
 ↓
Publish

The system should become more useful over time.

---

47. COMMUNITY INTELLIGENCE

Analyze authorized/publicly available user interactions such as:

- Comments
- Replies
- Questions
- Objections
- Pain points
- Repeated requests
- Frequently asked questions

Convert them into:

- Content ideas
- FAQ content
- Product insights
- Objection-handling content
- Audience intelligence

---

48. ATTRIBUTION

Where data is available, support:

Content
 ↓
Engagement
 ↓
Profile Visit
 ↓
Website
 ↓
Lead
 ↓
CRM
 ↓
Conversion
 ↓
Revenue

Do not claim attribution where tracking data is unavailable.

Architecture should support future CRM integrations.

---

49. TIME SAVED ENGINE

Track estimated manual effort versus AI-assisted effort.

Example:

Estimated manual work: 6h 40m
AI Marketing OS time: 8m
Time saved: 6h 32m

Show:

- Current time saved
- Historical time saved
- Time saved by content
- Time saved by campaign
- Time saved by automation

This is a major product value metric.

---

50. BILLING

Use subscription plans with database-driven configuration.

Example India pricing baseline:

- Free — ₹0
- Starter — ₹499/month
- Growth — ₹999/month
- Pro — ₹1,999/month
- Business — ₹4,999/month
- Enterprise — Custom

Global baseline:

- Free — $0
- Starter — $9/month
- Growth — $19/month
- Pro — $39/month
- Business — $99/month
- Enterprise — Custom

These are configurable defaults, not permanent hard-coded prices.

---

51. CREDIT SYSTEM

Use credits rather than promising a fixed number of videos.

Reason:

AI generation costs vary by:

- Resolution
- Duration
- Model
- Voice
- Images
- Video generation
- Regeneration
- Rendering
- Storage

Credit usage should be visible before expensive operations when practical.

---

52. AI COST MANAGEMENT

Track:

- Provider cost
- Model cost
- Tokens
- Image generations
- Video generations
- Voice generations
- Render cost
- Storage
- CDN
- Retries
- Regenerations

Admin should see AI/API spend.

User should see relevant credit consumption.

Implement:

- Usage limits
- Spend limits
- Alerts
- Provider budgets
- Per-user/org quotas

---

53. AI COST BASELINE

Initial all-in planning baseline:

- Simple 20–30 sec: approximately ₹10–₹25
- Normal 30–60 sec: approximately ₹25–₹60
- High-quality 30–60 sec: approximately ₹60–₹120
- Premium/heavy: approximately ₹120–₹250+

Target optimization:

Average ~₹40–₹₹60/video initially, with a goal of optimizing toward approximately ₹30–₹₹40 where quality permits.

Actual costs must be measured from real provider usage.

Never hide cost by pretending expensive operations are free.

---

54. ADMIN PANEL

Admin system should provide:

- Users
- Organizations
- Subscriptions
- Revenue
- Credits
- AI spend
- Content volume
- Publishing status
- Provider health
- Failed jobs
- Queue health
- Storage
- System health
- Support investigation
- Feature flags
- Policy configuration
- Refunds
- Billing history

---

55. ADMIN ANALYTICS

Charts should include:

- MRR
- Revenue
- Active users
- Organizations
- New users
- Churn
- Content generated
- Content published
- AI spend
- Credits consumed
- Failed jobs
- Provider failures
- Queue depth
- Storage usage

Only use real system data.

---

56. NOTIFICATIONS

Support notifications for:

- Approval required
- Content ready
- Render complete
- Publishing successful
- Publishing failed
- AI generation failed
- Credits low
- Payment failure
- Subscription events
- Important analytics insights
- System incidents where appropriate

---

57. GLOBAL SEARCH

Search across:

- Content
- Campaigns
- Assets
- Publications
- Analytics
- Customers/organizations
- Projects

Use PostgreSQL FTS initially.

---

58. AUDIT LOG

Track important actions:

- Login
- Logout
- Content creation
- Content edit
- Approval
- Publishing
- Schedule changes
- Billing changes
- Team changes
- API connection changes
- Permission changes
- Admin actions

Audit logs should be tenant-aware and protected from ordinary users modifying them.

---

59. VERSION HISTORY

Support version history for important objects:

- Content
- Scripts
- Scenes
- Brand settings
- Creative DNA
- Campaigns

Where appropriate:

- Undo
- Restore
- Compare versions

---

60. TEAM COLLABORATION

Architecture should support:

- Team members
- Roles
- Invitations
- Approval workflows
- Comments
- Feedback
- Assignment
- Client review
- Activity history

---

61. APPROVAL SYSTEM

Content may move through:

Draft
 ↓
AI Generated
 ↓
Quality Checked
 ↓
Ready for Review
 ↓
Approved
 ↓
Scheduled
 ↓
Published

Allow rejection with feedback.

AI should use feedback to improve future generation where appropriate.

---

62. COMMENTS / FEEDBACK

Users should be able to leave contextual feedback on:

- Content
- Scene
- Campaign
- Draft
- Version

Examples:

«“Scene 4 change.”»

«“CTA stronger.”»

«“Use our original product image.”»

---

63. MEDIA VERSION MANAGEMENT

Maintain:

- Original asset
- AI-generated asset
- Edited asset
- Render version
- Final approved version

Avoid accidental destructive overwrites.

---

64. API ARCHITECTURE

Backend should expose structured APIs for:

- Auth
- Organizations
- Users
- Brand Brain
- Creative DNA
- Content
- Campaigns
- Calendar
- Assets
- AI jobs
- Video rendering
- Publishing
- Analytics
- Billing
- Credits
- Notifications
- Admin

Use consistent:

- Validation
- Authentication
- Authorization
- Error handling
- Pagination
- Rate limiting
- Idempotency

---

65. WEBHOOKS

Support webhook architecture for:

- Payment events
- Social platform events where supported
- AI provider callbacks where supported
- Rendering completion
- Publishing events

Webhook handlers must be idempotent.

---

66. BACKGROUND JOB SYSTEM

Use BullMQ + Redis.

Jobs should include:

- AI generation
- Research
- Video generation
- Rendering
- Caption generation
- Publishing
- Analytics sync
- Notifications
- Calendar jobs
- Cleanup
- Billing-related asynchronous tasks

Every job needs:

- ID
- Status
- Attempt count
- Error
- Started time
- Completed time
- Provider
- Cost where applicable

---

67. FAILURE HANDLING

Every external dependency can fail.

Implement:

- Retries
- Exponential backoff
- Idempotency
- Dead-letter handling
- User-visible status
- Admin visibility
- Provider fallback where appropriate

Never silently lose a job.

---

68. OBSERVABILITY

Monitor:

- API latency
- Error rates
- AI failures
- Provider latency
- Render time
- Queue depth
- Job failures
- Publishing failures
- Analytics sync failures
- Database performance
- Redis health
- Storage failures
- Webhook failures

---

69. QUEUE / WORKER MONITORING

Admin/operations must be able to see:

- Queued jobs
- Running jobs
- Failed jobs
- Retried jobs
- Stuck jobs
- Worker health
- Processing time

---

70. SECURITY

Implement:

- Secure authentication
- Password hashing
- JWT/session security
- Token rotation
- RBAC
- Tenant isolation
- Input validation
- Output validation
- API rate limits
- CSRF protection where relevant
- CORS configuration
- Secure headers
- Secret management
- Encryption in transit
- Encryption at rest where supported
- Audit logs
- Webhook signature verification
- File upload validation
- Malware/security scanning architecture where appropriate

Never expose provider secrets to the frontend.

---

71. DATA GOVERNANCE

Support:

- Privacy controls
- Data export
- Data deletion
- Account deletion
- Retention policies
- Consent handling
- Connected-account revocation
- Asset deletion
- Organization deletion

Avoid storing unnecessary sensitive information.

---

72. BACKUP / RECOVERY

Implement:

- Database backups
- Backup verification
- Migration strategy
- Restore procedures
- Storage recovery strategy
- Disaster recovery documentation

A backup is not considered complete until restore procedures are tested.

---

73. FEATURE FLAGS

Feature flags should control:

- New AI providers
- New publishing providers
- Experimental editor
- New analytics
- Beta features
- Pricing/credit changes

Avoid hard-coded production switches.

---

74. TIME ZONE / LOCALIZATION

Support:

- User timezone
- Organization timezone
- Scheduled publishing in local time
- UTC storage internally
- Localization
- Multiple currencies
- Multiple languages

---

75. ACCESSIBILITY

UI should support:

- Keyboard navigation
- Screen readers
- Focus states
- Sufficient contrast
- Accessible forms
- Accessible dialogs
- Reduced-motion preference
- Semantic HTML

---

76. PREMIUM UI/UX

The application must feel like a premium professional product.

Design principles:

- Clean typography
- Strong hierarchy
- Consistent spacing
- Consistent icon system
- Carefully designed cards
- Subtle animations
- Excellent dark mode
- Excellent light mode
- No unnecessary gradients
- No random visual effects
- No generic AI-dashboard appearance

---

77. DESIGN SYSTEM

Create reusable components:

- Buttons
- Inputs
- Selects
- Modals
- Dialogs
- Cards
- Tables
- Tabs
- Navigation
- Charts
- Empty states
- Loading states
- Error states
- Toasts
- Progress indicators
- Timeline
- Scene cards
- Media previews

All screens must use the same design system.

---

78. DASHBOARD UX

Dashboard should provide:

- Greeting
- Current marketing goal
- Today's plan
- Content ready
- Growth
- Time saved
- Recent performance
- Important alerts
- Main CTA:

Create with AI

The dashboard should prioritize actions and insights over decorative widgets.

---

79. AI-FIRST CREATION UX

The user should be able to type:

«“Mere naye product ke liye 30-sec Instagram Reel banao.”»

The system should understand the request and generate a plan.

It should not force the user to manually configure:

- Scene count
- Voice
- Camera
- Transitions
- Music
- Caption timing

unless they want advanced control.

---

80. VIDEO STUDIO

Video Studio should include:

- Preview
- Timeline
- Scenes
- Scene editor
- Voice
- Captions
- Assets
- Brand controls
- AI suggestions
- Regenerate selected scene
- Version history

The experience should resemble a professional creative workspace while remaining simple for beginners.

---

81. RESPONSIVE DESIGN

Support:

- Desktop
- Tablet
- Mobile

Complex video editing may prioritize desktop while maintaining usable mobile review/approval workflows.

---

82. ANALYTICS UX

Charts must answer useful questions.

Examples:

- What content is performing?
- Which platform works?
- Which hooks work?
- Which campaign is generating results?
- How much time did AI save?
- How much AI credit was consumed?
- What should we create next?

---

83. NOTIFICATION CENTER

Provide a centralized notification center with:

- unread state
- timestamps
- categories
- deep links
- read/unread actions

---

84. ACTIVITY CENTER

Show organization activity such as:

- Content created
- Content approved
- Content published
- Team changes
- Campaign changes
- Billing events

---

85. ONBOARDING PROGRESS

Show progress such as:

- Business setup
- Brand identity
- Social connections
- Audience
- Goals
- First strategy
- First content
- First publication

Do not overwhelm the user.

---

86. TEST STRATEGY

Implement:

Unit tests

Business logic.

Integration tests

API/database/jobs.

Security tests

Authentication/authorization/tenant isolation.

E2E tests

Critical user workflows.

UI tests

Important interface flows.

AI pipeline tests

Provider mocks and real-provider controlled tests.

Rendering tests

Video output validation.

Publishing tests

Provider sandbox/test environments where available.

---

87. CRITICAL E2E TEST

At minimum, verify:

Register
 ↓
Login
 ↓
Create Organization
 ↓
Complete Onboarding
 ↓
Create Brand Brain
 ↓
Connect Platform
 ↓
Generate Strategy
 ↓
Create Content
 ↓
Generate Video
 ↓
Quality Check
 ↓
Approve
 ↓
Schedule
 ↓
Publish
 ↓
Sync Analytics
 ↓
Display Insights

This entire loop must work before calling the core product complete.

---

88. REQUIREMENTS MATRIX

Every requirement must map to:

Requirement
 ↓
Feature
 ↓
API
 ↓
Database
 ↓
UI
 ↓
Worker
 ↓
Test
 ↓
Verification

No requirement should exist only as documentation.

---

89. DEFINITION OF DONE

A feature is NOT complete merely because code exists.

It is complete only when:

- Implemented
- Integrated
- Tested
- Error states handled
- Loading states handled
- Empty states handled
- Security checked
- Tenant isolation checked
- UI polished
- Responsive behavior checked
- Relevant docs updated
- End-to-end flow verified

---

90. DESIGN QA

For every major UI phase:

Build
 ↓
Run
 ↓
Screenshot
 ↓
Review
 ↓
Fix
 ↓
Screenshot again
 ↓
Approve

Do not consider AI-generated UI finished without visual QA.

---

91. AI QUALITY QA

Test:

- Prompt quality
- Brand consistency
- Hallucination risk
- Factual accuracy
- Relevance
- Platform suitability
- Scene coherence
- Voice quality
- Caption accuracy
- Rendering quality

---

92. EXTERNAL DEPENDENCIES

External providers must be isolated behind adapters.

Examples:

AIProvider
ImageProvider
VideoProvider
VoiceProvider
SocialProvider
PaymentProvider
StorageProvider
AnalyticsProvider

This allows provider replacement without rewriting core business logic.

---

93. PROVIDER HEALTH

Track:

- Availability
- Error rate
- Latency
- Cost
- Rate limits
- Remaining quota
- Failure trends

Use provider health in model routing where appropriate.

---

94. CREDITS AND QUOTAS

Support:

- Monthly credits
- Usage limits
- Organization limits
- User limits
- Provider limits
- Rate limits
- Spend caps

Warn users before critical limits.

---

95. BILLING WEBHOOKS

Billing events must be idempotent.

Handle:

- Subscription created
- Subscription updated
- Subscription canceled
- Payment succeeded
- Payment failed
- Refund
- Invoice events

Never trust only frontend billing state.

---

96. STRIPE TEST MODE

Development should use Stripe test mode.

Production secrets must remain separate.

Billing should be tested with webhook simulations/test events before production deployment.

---

97. PRODUCT OPERATIONS GUIDE

Create:

"/docs/PRODUCT_OPERATIONS_GUIDE.md"

It must document:

Daily operations

- System health
- Provider health
- Queue health
- Failed jobs
- Publishing failures
- Billing
- Storage
- Credits

Incident response

Detect
 ↓
Classify
 ↓
Contain
 ↓
Recover
 ↓
Verify
 ↓
Document

Common incidents

- AI provider unavailable
- Rendering stuck
- Publishing failure
- Analytics sync failure
- Payment webhook failure
- Database issue
- Redis issue
- Storage issue

Business operations

- Plans
- Credits
- Limits
- Refunds
- Subscriptions
- Feature flags
- Provider spending

Support operations

Investigate using:

- Audit history
- Job history
- Publishing logs
- Billing history
- User activity
- Provider logs

---

98. REQUIRED PROJECT DOCUMENTATION

Create and maintain:

/docs/
  MASTER_SPEC.md
  ARCHITECTURE.md
  DESIGN_SYSTEM.md
  REQUIREMENTS_MATRIX.md
  AI_AGENTS.md
  MODEL_ROUTER.md
  PROVIDER_CATALOG.md
  VIDEO_PIPELINE.md
  PUBLISHING.md
  ANALYTICS.md
  GROWTH_ENGINE.md
  BILLING.md
  SECURITY.md
  DATA_GOVERNANCE.md
  OBSERVABILITY.md
  API.md
  TEST_STRATEGY.md
  DEFINITION_OF_DONE.md
  PRODUCT_OPERATIONS_GUIDE.md
  DEPLOYMENT.md
  SETUP.md
  TROUBLESHOOTING.md
  POLICY_ENGINE.md
  DECISION_LOG.md
  PROJECT_STATUS.md
  CHANGELOG.md

---

99. PROJECT STATUS

"PROJECT_STATUS.md" is the short-term state memory for the coding agent.

It should contain:

- Current phase
- Completed features
- Current task
- Blockers
- Known bugs
- Pending verification
- Next task
- Important environment state

---

100. DECISION LOG

"DECISION_LOG.md" should record major architectural decisions.

Example:

Decision:
Use NestJS as primary backend.

Reason:
Separates application architecture from Next.js frontend and supports scalable service organization.

Never repeatedly reconsider already-approved architecture without a real reason.

---

101. CHANGELOG

Record:

- Feature
- Bug fix
- Architecture change
- Provider change
- Database migration
- Security change
- Breaking change

---

102. TROUBLESHOOTING

Document common problems:

- Database connection
- Redis connection
- Migration failure
- OAuth failure
- Provider API failure
- FFmpeg failure
- Storage failure
- Publishing failure
- Webhook failure
- Build failure
- Deployment failure

---

103. BACKEND DOMAIN STRUCTURE

Organize NestJS by business domains rather than one giant controller.

Example:

auth/
organizations/
users/
brand/
creative-dna/
strategy/
research/
content/
campaigns/
calendar/
assets/
ai/
video/
publishing/
analytics/
growth/
billing/
notifications/
admin/
audit/
policy/

---

104. DATABASE DOMAIN MODEL

Database should support entities such as:

- User
- Organization
- Membership
- Role
- Brand
- BrandBrain
- CreativeDNA
- Product
- Audience
- Competitor
- Goal
- Campaign
- ContentItem
- ContentVariant
- Scene
- Asset
- Publication
- PlatformConnection
- AnalyticsSnapshot
- Experiment
- AIJob
- AIUsage
- CreditLedger
- Subscription
- Payment
- Notification
- AuditLog
- Version
- WebhookEvent

Schema must evolve through migrations.

---

105. CREDIT LEDGER

Do not simply overwrite a credit balance.

Maintain a ledger of:

- Credit grant
- Credit usage
- Credit refund
- Credit adjustment
- Expiration where applicable

This makes billing auditable.

---

106. IDEMPOTENCY

Critical operations must be idempotent:

- Publishing
- Payments
- Webhooks
- Credit transactions
- Job completion
- External API callbacks

Prevent duplicate charges and duplicate posts.

---

107. DATA CONSISTENCY

Use transactions where necessary.

Do not update related records independently when consistency requires an atomic operation.

---

108. FILE / MEDIA SECURITY

Uploaded files must have:

- Type validation
- Size limits
- Safe storage
- Unique identifiers
- Access control
- Signed URLs where appropriate
- Lifecycle policies

Do not expose private assets publicly by default.

---

109. SEARCHABLE KNOWLEDGE

Brand Brain should be searchable/retrievable by agents.

Avoid sending the entire historical knowledge base to every model call.

Use relevant-context retrieval.

---

110. AI CONTEXT MANAGEMENT

The AI system should use:

- Relevant context only
- Structured memory
- Summaries
- Retrieval
- Task-specific context

Do not send entire conversation history to every agent unnecessarily.

---

111. TOKEN / CONTEXT EFFICIENCY FOR CODING AGENTS

The coding agent must NOT reread the entire project specification for every task.

Workflow:

READ STATE
 ↓
INSPECT RELEVANT CODE
 ↓
READ RELEVANT DOCS
 ↓
PLAN
 ↓
IMPLEMENT
 ↓
TEST
 ↓
VERIFY
 ↓
UPDATE DOCS
 ↓
REPORT STATE

Repository documentation is persistent project memory.

---

112. CODING AGENT RULE

The coding agent should behave as an autonomous senior engineering team.

It should:

- Inspect before modifying
- Search existing code
- Reuse existing abstractions
- Avoid duplicate implementations
- Follow architecture
- Implement completely
- Run tests
- Fix failures
- Verify integration
- Update documentation
- Update project status

---

113. LARGE TASK EXECUTION

Break large work into verifiable tasks.

Example:

Phase
 ↓
Task 1
 ↓
Test
 ↓
Task 2
 ↓
Test
 ↓
Integration
 ↓
Verification

Do not implement huge changes blindly in one pass.

---

114. AGENT CONTINUITY

After every meaningful phase update:

- PROJECT_STATUS.md
- CHANGELOG.md
- DECISION_LOG.md where required

The next agent/session should be able to continue without reconstructing the entire conversation.

---

115. NO DUPLICATE ARCHITECTURE

Before introducing a new:

- Service
- Provider
- Component
- Queue
- Database table
- Utility
- Agent

Search the repository first.

If an equivalent exists, extend it.

---

116. NO UNNECESSARY INFRASTRUCTURE

Do not introduce:

- Kafka
- Kubernetes
- Elasticsearch
- Complex microservices
- Additional databases

unless actual product scale or a clear technical requirement justifies them.

Start modular and production-ready without premature complexity.

---

117. SCALING STRATEGY

Initial architecture should support:

- Horizontal API scaling
- Worker scaling
- Independent render workers
- Independent AI workers
- Queue-based workload distribution
- CDN media delivery
- Database optimization

Scale individual bottlenecks rather than scaling everything together.

---

118. RENDERING ARCHITECTURE

Rendering should support:

- Queue
- Worker
- Render job
- Progress
- Retry
- Cancellation where safe
- Multiple resolutions
- Thumbnail
- Final output
- Storage upload
- CDN delivery

Large rendering tasks must not block API servers.

---

119. ANALYTICS PIPELINE

Analytics synchronization should be asynchronous.

Example:

Platform API
 ↓
Analytics Worker
 ↓
Normalize Data
 ↓
Store Snapshot
 ↓
Aggregate
 ↓
Insights
 ↓
Growth Recommendations

---

120. ANALYTICS DATA QUALITY

Store:

- Source
- Timestamp
- Platform
- Metric
- Raw/normalized value
- Sync status

Never mix data from different time periods without clearly defining the aggregation.

---

121. REPORTING

Support:

- Dashboard reports
- Campaign reports
- Platform reports
- Content reports
- Growth reports
- AI usage reports

Architecture should support CSV/PDF/report-ready exports where appropriate.

---

122. ALERTS

Useful alerts:

- Publishing failed
- Provider unavailable
- Credits low
- Payment failed
- Rendering stuck
- Analytics sync failed
- Unusual API spend
- System health problem

---

123. USER EXPERIENCE FOR ERRORS

Errors must explain:

- What happened
- Whether the system retried
- What the user can do
- Whether credits were consumed
- Whether the operation is safe to retry

Avoid technical stack traces in normal user UI.

---

124. AUTOSAVE

Where appropriate, automatically save:

- Drafts
- Scene edits
- Content changes
- Settings

Avoid accidental loss of work.

---

125. CONTENT STATES

Recommended content lifecycle:

DRAFT
GENERATING
QUALITY_CHECK
READY
REVIEW
APPROVED
SCHEDULED
PUBLISHING
PUBLISHED
FAILED
ARCHIVED

---

126. MEDIA GENERATION STATES

Track separately:

QUEUED
RUNNING
SUCCEEDED
FAILED
CANCELED

Do not confuse AI job status with content status.

---

127. USER CONTROL OVER EXPENSIVE OPERATIONS

Before expensive operations where practical:

- Show estimated credit usage
- Show expected output
- Allow cancellation before processing
- Avoid duplicate generation
- Allow targeted regeneration

---

128. QUALITY-FIRST MODEL POLICY

Use:

«Cheap where quality does not matter. Premium where quality matters.»

Do not use cheap models for important creative outputs merely to minimize API cost.

Use lower-cost models for:

- Classification
- Simple extraction
- Tagging
- Routing
- Basic formatting

Use higher-quality models for:

- Strategy
- Complex reasoning
- Final scripts
- Brand-sensitive content
- Critical recommendations

---

129. DEVELOPMENT COST CONTROL

During development:

- Mock expensive providers
- Use sandbox/test APIs
- Cache stable outputs
- Avoid repeated generation
- Test pipeline stages independently
- Track provider costs
- Use real high-quality generation for final validation

Quality must not be compromised in production.

---

130. REAL VS MOCKED SYSTEMS

Mocks are acceptable during early development.

But before a feature is declared complete, the real integration must be verified where credentials/API access are available.

Do not label a mocked integration as fully production-ready.

---

131. OFFICIAL API POLICY

For social publishing/integration:

- Prefer official APIs
- Use OAuth
- Follow platform terms
- Store access tokens securely
- Refresh tokens appropriately
- Handle revoked access
- Respect platform limitations

Never build critical publishing around unauthorized automation.

---

132. CREDENTIAL HANDLING

The agent may ask the user only for credentials/authorization that genuinely cannot be created automatically.

Never:

- Commit secrets
- Print secrets
- Put API keys in frontend code
- Store credentials in source control

---

133. SETUP DOCUMENT

"SETUP.md" must contain:

- Prerequisites
- Environment variables
- Database setup
- Redis setup
- Local development
- Worker startup
- Storage setup
- Provider configuration
- OAuth setup
- Stripe setup
- Test commands

---

134. DEPLOYMENT DOCUMENT

"DEPLOYMENT.md" must contain:

- Build
- Database migration
- Environment configuration
- Worker deployment
- API deployment
- Frontend deployment
- Storage
- CDN
- Monitoring
- Rollback
- Health checks

---

135. HEALTH CHECKS

Provide health endpoints/checks for:

- API
- Database
- Redis
- Workers
- Storage
- External provider availability where appropriate

---

136. SYSTEM HEALTH DASHBOARD

Admin should see:

- API status
- DB status
- Redis status
- Queue status
- Worker status
- Provider status
- Storage status
- Publishing status

---

137. SUPPORTABILITY

Every important object should have enough identifiers to investigate problems.

For example:

Organization ID
User ID
Content ID
Job ID
Publication ID
Provider request ID
Webhook ID
Payment ID

Support staff must be able to trace a failure end-to-end.

---

138. PRODUCT LEARNING

The system should learn from:

- User approvals
- User edits
- User rejection reasons
- Content performance
- Campaign performance
- Platform performance
- Audience feedback

Learning should improve future recommendations without silently changing important brand rules.

---

139. USER OVERRIDES

Users must be able to override AI recommendations.

Examples:

- Brand tone
- Content topic
- Posting time
- Platform
- Scene
- Asset
- CTA
- Duration

User overrides should be respected.

---

140. BRAND SAFETY

Prevent or flag:

- Unsupported claims
- Misleading statements
- Unsafe content
- Copyright concerns
- Sensitive content
- Platform policy issues

Use appropriate human review for high-risk cases.

---

141. PRODUCT PRINCIPLE FOR AI AUTONOMY

The AI should automate work, not remove user agency.

The user should always be able to:

- Review
- Edit
- Reject
- Approve
- Undo
- Regenerate
- Override

---

142. FIRST-TIME USER EXPERIENCE

A new user should be able to reach the first meaningful result quickly.

Ideal path:

Sign Up
 ↓
Business Setup
 ↓
Connect Account
 ↓
AI Understands Brand
 ↓
AI Creates Strategy
 ↓
AI Creates First Content
 ↓
User Reviews
 ↓
Publish

Avoid unnecessary setup before demonstrating value.

---

143. FIRST VALUE MOMENT

The product should aim to deliver an obvious first value moment:

«“I gave the AI my business information and it created a useful marketing plan/content for me.”»

---

144. GLOBAL PRODUCT READINESS

Architecture should support global users through:

- Time zones
- Multiple currencies
- Multiple languages
- Localization
- Region-specific platforms
- Region-specific policies
- Global CDN
- International billing

---

145. PRIVACY-FIRST DESIGN

Only collect data necessary for product functionality.

Clearly separate:

- User data
- Organization data
- Brand data
- Analytics data
- AI-generated data
- Connected-platform credentials

---

146. PRODUCT DATA EXPORT

Users should be able to export appropriate:

- Content
- Campaign data
- Analytics
- Assets
- Brand information
- Account data

---

147. DELETE / REVOKE

Support:

- Disconnect social account
- Delete content
- Delete assets
- Delete organization
- Delete account
- Revoke tokens

Deletion should follow documented retention rules.

---

148. FUTURE API / WHITE-LABEL READINESS

Architecture should allow future:

- Public API
- Webhooks
- Agency accounts
- White-label
- Enterprise integrations

Do not build these all on day one, but do not make the architecture impossible to extend.

---

149. IMPLEMENTATION ORDER

Recommended implementation sequence:

Phase 0

Architecture + repository foundation

Phase 1

Authentication + organizations + database

Phase 2

Onboarding + Brand Brain + Creative DNA

Phase 3

AI orchestration + Model Router

Phase 4

Research + Strategy + Content Ideation

Phase 5

Content Calendar + Campaigns

Phase 6

Video Studio + Media Pipeline

Phase 7

AI Editor + Scene-level regeneration

Phase 8

Assets + Asset Intelligence

Phase 9

Social Connections + Publishing

Phase 10

Analytics + Growth Engine

Phase 11

Billing + Credits

Phase 12

Admin + Operations

Phase 13

Security + Observability + Recovery

Phase 14

E2E testing + UI polish + production QA

---

150. PHASE COMPLETION RULE

Never move to the next major phase simply because files exist.

A phase must satisfy:

Implementation
+
Integration
+
Testing
+
Visual QA
+
Security Review
+
Documentation
+
Verification

---

151. MASTER ACCEPTANCE FLOW

The final product must be capable of:

USER
 ↓
REGISTER
 ↓
CREATE ORGANIZATION
 ↓
ONBOARD BUSINESS
 ↓
CONNECT SOCIAL ACCOUNT
 ↓
BUILD BRAND BRAIN
 ↓
AI RESEARCH
 ↓
AI STRATEGY
 ↓
AI CONTENT PLAN
 ↓
AI SCRIPT
 ↓
STORYBOARD
 ↓
SCENES
 ↓
VISUALS
 ↓
VOICE
 ↓
MUSIC/SFX
 ↓
CAPTIONS
 ↓
AI EDITOR
 ↓
QUALITY GATE
 ↓
USER APPROVAL
 ↓
PLATFORM VARIANT
 ↓
SCHEDULE
 ↓
PUBLISH
 ↓
ANALYTICS
 ↓
AI INSIGHTS
 ↓
GROWTH RECOMMENDATION
 ↓
BETTER NEXT CONTENT

This loop is the core product.

---

152. FINAL ACCEPTANCE CRITERIA

The system is production-ready only when:

Product

- Core workflow works end-to-end
- UX is coherent
- AI-first flow works
- Manual controls work

Backend

- APIs work
- Database works
- Jobs work
- Authentication works
- Tenant isolation works

AI

- Model router works
- Providers are abstracted
- Fallback works
- Costs are tracked
- Context is controlled

Video

- Script generation works
- Scene generation works
- Media generation works
- Rendering works
- Scene-level regeneration works
- Final export works

Publishing

- OAuth works
- Platform variants work
- Scheduling works
- Publishing works
- Failures are recoverable

Analytics

- Data sync works
- Dashboard graphs use real data
- Insights work
- Growth loop works

Billing

- Subscription works
- Credits work
- Webhooks work
- Ledger is auditable

Security

- Authentication secure
- Authorization secure
- Tenant isolation tested
- Secrets protected
- Rate limits present
- Audit logs present

Operations

- Monitoring works
- Logs work
- Failed jobs visible
- Backups documented
- Recovery tested

UX

- Responsive
- Accessible
- Light mode
- Dark mode
- Loading states
- Empty states
- Error states
- Visual QA completed

---

153. PERFORMANCE PRINCIPLE

Optimize where measurement shows a bottleneck.

Priorities:

1. User-perceived responsiveness
2. API reliability
3. Queue reliability
4. Rendering throughput
5. Database performance
6. AI latency
7. Storage/CDN delivery

Do not prematurely optimize theoretical bottlenecks.

---

154. ARCHITECTURAL PRINCIPLE

Use modular architecture first.

The system should be:

- Modular
- Testable
- Observable
- Replaceable
- Scalable

But not unnecessarily complicated.

---

155. FINAL AGENT EXECUTION PROTOCOL

The coding agent must follow this exact loop:

1. READ PROJECT_STATUS
2. INSPECT REPOSITORY
3. IDENTIFY RELEVANT DOCUMENTATION
4. SEARCH EXISTING IMPLEMENTATION
5. DEFINE TASK
6. PLAN
7. IMPLEMENT
8. RUN TESTS
9. FIX FAILURES
10. RUN INTEGRATION CHECK
11. PERFORM UI QA WHEN APPLICABLE
12. VERIFY REQUIREMENTS
13. UPDATE DOCUMENTATION
14. UPDATE PROJECT_STATUS
15. UPDATE CHANGELOG
16. REPORT EXACT STATE

Never claim completion without verification.

---

156. AGENT REPORT FORMAT

After each major task, report:

Completed:
- ...

Verified:
- ...

Tests:
- ...

Known issues:
- ...

Files changed:
- ...

Next:
- ...

---

157. CONTEXT / TOKEN MANAGEMENT

The project must not depend on one giant chat history.

Persistent source of truth:

Repository
+
docs/
+
PROJECT_STATUS.md
+
DECISION_LOG.md
+
CHANGELOG.md

Only relevant context should be loaded for each task.

Long-running AI coding work should be divided into verifiable steps.

Context efficiency must never mean skipping required reasoning, testing or QA.

---

158. NO FALSE COMPLETION

The agent must never say:

«“100% complete”»

unless the relevant feature has actually been:

- implemented
- integrated
- executed
- tested
- verified

A partially mocked or untested feature must be marked accordingly.

---

159. QUALITY STANDARD

The final product should feel like a serious SaaS product rather than:

- a prototype
- a template
- an AI-generated dashboard
- a collection of disconnected tools

The product should feel coherent from:

Landing → Onboarding → Dashboard → AI Creation → Video Studio → Publishing → Analytics → Billing → Admin

---

160. FINAL PRODUCT PRINCIPLE

The product is not:

«“AI that makes posts.”»

It is:

«An AI Marketing Operating System that understands a business, creates and manages marketing, measures the results, learns from them, and continuously improves the next marketing decision.»

---

161. FINAL START INSTRUCTION FOR CODING AGENT

Start by inspecting the repository.

Do not blindly rewrite the existing application.

First:

1. Determine the current architecture.
2. Identify what is already implemented.
3. Compare the implementation against this Master Specification.
4. Create/update the "/docs" source-of-truth files.
5. Create "PROJECT_STATUS.md".
6. Create "REQUIREMENTS_MATRIX.md".
7. Identify completed, partial and missing functionality.
8. Produce the implementation plan.
9. Begin with the highest-priority foundational phase.
10. Implement incrementally.
11. Test every phase.
12. Fix failures before moving forward.
13. Perform UI/design QA.
14. Keep documentation synchronized.
15. Never claim a feature is complete without verification.

Do not ask the user to repeatedly explain requirements already present in this specification or repository documentation.

Ask the user only when an external credential, authorization, business decision, or genuinely missing requirement is unavoidable.

Build for production quality, not merely demo completion.

END OF MASTER SPECIFICATION.