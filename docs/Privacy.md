# Privacy Policy

**Effective Date:** June 6, 2026

JobbedIn ("we", "us", or "our") is an AI-assisted job application tool that helps you research companies and generate personalized cover letters and recruiter messages. This Privacy Policy explains what personal data we collect, how we use it, and your rights regarding that data.

---

## 1. Information We Collect

### Account Information
When you register, we collect your **email address** and a **hashed password** (processed by better-auth). We never store your password in plain text.

### Resume Content
We store the text content of any resume you upload (.pdf, .txt, or .md). This content is extracted from your file and stored in our database linked to your account.

### Job Descriptions
We store any job description text you submit, including any URL or pasted content you provide.

### AI-Generated Outputs
We store the outputs produced by our AI workflow on your behalf, including:
- Company research summaries
- Job description match analyses
- Resume critique feedback
- Generated cover letters
- Generated recruiter messages
- Chat refinement history (your follow-up messages and AI replies)

### Session Data
We store session tokens to keep you logged in. Sessions expire automatically and are managed by better-auth.

### Usage Data
We do not collect analytics, tracking pixels, or behavioral data beyond what is necessary to run the service.

---

## 2. How We Use Your Data

We use your data solely to provide the JobbedIn service:

- To authenticate your account and maintain your session
- To run the AI workflow against your resume and job descriptions
- To display your stored results and chat history
- To improve reliability and debug errors (server-side logs)

We do not sell your data. We do not use your data to train AI models. We do not share your data with third parties except as described in Section 3.

---

## 3. Third-Party Services

Running the core features of JobbedIn requires sending portions of your data to external services. By using JobbedIn, you acknowledge this.

| Service | Purpose | Data Sent |
|---------|---------|-----------|
| **OpenRouter** (openrouter.ai) | LLM inference for resume analysis, cover letter and message generation | Resume content, job description content |
| **Tavily** (tavily.com) | Web search for company research | Company name extracted from job description |
| **Vercel** | Application hosting | Standard HTTP request metadata |
| **Supabase / PostgreSQL** | Database storage | All user data described in Section 1 |

We recommend reviewing the privacy policies of these providers for how they handle data passed through their APIs.

---

## 4. Data Retention

Your data is retained for as long as your account is active. If you delete a resume or job entry through the application, the associated records are removed from the database. If you wish to delete your account and all associated data, contact us at the address in Section 9.

Expired sessions remain in the database until manually pruned. They do not grant access.

---

## 5. Data Security

All data is scoped to your user account. Our API routes validate your session on every request and filter all database queries by your user ID. We use HTTPS for all data in transit. Database credentials and secrets are stored as environment variables and never committed to source control.

No system is completely secure. We cannot guarantee absolute protection against unauthorized access.

---

## 6. Children's Privacy

JobbedIn is not directed at children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal data, contact us and we will delete it.

---

## 7. Your Rights

Depending on your jurisdiction, you may have the right to:

- **Access** the personal data we hold about you
- **Correct** inaccurate data
- **Delete** your account and associated data
- **Export** your data

To exercise any of these rights, contact us using the information in Section 9.

---

## 8. Changes to This Policy

We may update this Privacy Policy from time to time. We will update the effective date at the top of this document. Continued use of JobbedIn after changes are posted constitutes acceptance of the updated policy.

---

## 9. Contact

For privacy questions, data deletion requests, or other concerns:

**Huu Phat Loc Nguyen** — fatlock1712@gmail.com  
**Brian Phan** — linkedin.com/in/brphan/
