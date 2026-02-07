# Questions & Answers

### Why did you make this?
I want to write text inside of SEB. MS Word app is unusable because it allows for co-authoring. MS Word online is unreliable to whitelist due to login requirements. So I made this tool because it's easy to whitelist and it's closed. Also, I wanted a tool that's not bloated.

### Is this tool simple for teachers to use/run?
The tool itself is extremely simple to interact with. However, to host this tool, you need to know some basic information about hosting websites. It's not a program that you can just double-click to open and run. You actually need to deploy it to a website (or localhost). There's no installer.
 
### What happens if I lose internet?
If someone loads the website, it doesn't matter if they lose their internet as long as they don't close the window. If you load it and then go offline, you can write and save the document without issues. It also passively saves to localStorage without internet. This results in less disruption if there are internet issues.

### Why is it open source and free?
Because otherwise nobody would use it, duh. :p

### Who is this for?
It's mainly for teachers who want to have a writing program that works well inside of Safe Exam Browser (SEB).

### I wrote a text through SEB, but my text disappeared when I restarted the test!
This is because in Safe Exam Browser, you need to uncheck the two options that clear cache when you exit SEB. They're in the "Exam" tab.

### Is it enought to just whitelist the domain for the site?
There could technically be an issue in SEB if a bot challenge (aka. "Are you human?") appears if you host through e.g. Cloudflare, as it would probably redirect you to a non-whitelisted link for the bot challenge. If you wanna be 100% sure, don't use Cloudflare if you're planning on using this tool with SEB.

### What about shared computers?
This tool was not intended to be used by shared devices. Student B will see student A's text because it's stored in localStorage.

### How do I handle updates?
Fork this repo instead here on GitHub so you'll have a stable version for yourself. Pulling often from this repo is not recommended if you want a stable version.
