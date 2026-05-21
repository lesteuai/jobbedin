## Inspiration
It's 2026. You are trying to apply for a job, an internship, anything. We were just like you, trying over 500 applications, only a handful of interviews to speak off. This is not mentioning how we have to adjust our letters and Linkedin messages to send to hiring managers, founders, recruiters. I have tried with Claude.ai, got custom prompts, rules and everything. But it is tedious having to:
- Edit the resume
- Edit the job
- Telling it to generate message instead of mail, because we were a few message level deep and it was a hassle writing yet another prompt just for a message.
So we came up with this. Meet JobbedIn, your job hunting buddy.

## What it does
JobbedIn, an agentic AI system that:
- Receive your resume and job description.
- Research your chosen company based on the job description. Who they are, what they do, what it is like to work with them, etc.
- Cross-reference your experience in the resume against the job requirements
- Provide a critique of the resume.
- Generate a comprehensive summary report based on the preceding steps.
- Create a personalized cover letter and a 100-word message to send to recruiters on LinkedIn.

## How we built it
We built it with a standard tech stack:
- Next.js, Tailwind, Postgres for web stack.
- LangGraph for agent orchestration.
- Using OpenAI-compatible LLM models in OpenRouter.
- UI designed by Lovable based on Yahoo Messenger of the 2000s (one of us was from that era)
- Wireframe made by Canva (drawn by us, not AI).
- Claude Code and Gemini handled the coding.
- Deployed to Vercel with Supabase as the database.

## Challenges we ran into
- Working together: Due to our difference in experience, I (Brian) became the project manager. I helped my teammate understand how to use git, how to draw wireframe, understand task and priority. I also taught him to not always rely on AI and to understand deeply what to do, because they can and have been wrong. He taught me how to be more of a leader and manager instead of just another coder. We both came up with ideas, I helped him realize the implimentation of those ideas.
- Vercel was a pain to set up in deployment of anything that is not the production environment. To deploy to the development environment, I had to run `vercel` on my computer instead of using the web UI, because it didn't have the option to deploy from anywhere except `main` branch.
- OpenRouter free rate limit. That's what happened when you used free models for an agentic task. It tool-called a lot.

## Accomplishments that we're proud of
This whole project. What we have done to achieve this.

## What we learned
- Supabase is good stuff. I should have learned earlier. Vercel is only okay. Least is still appealing to look at, compared to AWS, GCP. 
- LangGraph is quite easy to grasp. I guess AI agent framework is another tool to add to the pile that is full stack development (not recommend though. We're already stressed enough by doing jobs of 3 men: front, back, DevOps).

## What's next for JobbedIn
- Brush it up for production deployment. Or at least, people can download and use this with just an API key to an OpenAI-compatible model.
