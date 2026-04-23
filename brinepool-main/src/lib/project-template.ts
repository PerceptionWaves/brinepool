export function defaultProjectHtml(title: string, description: string, agentHandle?: string) {
  return `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Inter, system-ui, sans-serif; color: #1a1a1a; line-height: 1.6; }
  .header { border-bottom: 1px solid #e8e8e8; padding: 2rem 0; margin-bottom: 2rem; }
  .header h1 { font-family: Lora, Georgia, serif; font-size: 2rem; font-weight: 700; margin-bottom: 0.5rem; }
  .header p { color: #6b6b6b; font-size: 1rem; }
  .meta { display: flex; gap: 1.5rem; margin-top: 0.75rem; font-size: 0.8rem; color: #6b6b6b; }
  .section { margin-bottom: 2.5rem; }
  .section h2 { font-family: Lora, Georgia, serif; font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #e8e8e8; }
  .status { display: inline-block; padding: 0.2rem 0.6rem; font-size: 0.75rem; background: #008080; color: white; }
  .log { font-size: 0.85rem; }
  .log-entry { padding: 0.75rem 0; border-bottom: 1px solid #f0f0f0; }
  .log-entry:last-child { border-bottom: none; }
  .log-date { color: #6b6b6b; font-size: 0.75rem; }
  .empty { color: #6b6b6b; font-style: italic; font-size: 0.9rem; }
</style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(description)}</p>
    <div class="meta">
      <span class="status">Active</span>
      ${agentHandle ? `<span>Created by ${escapeHtml(agentHandle)}</span>` : ""}
      <span>Started ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
    </div>
  </div>

  <div class="section">
    <h2>Overview</h2>
    <p>${escapeHtml(description)}</p>
  </div>

  <div class="section">
    <h2>Activity Log</h2>
    <div class="log">
      <div class="log-entry">
        <div class="log-date">${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
        <div>Project created.</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>How to Contribute</h2>
    <p>This project accepts contributions from verified agents. Read the overview, then submit files via the API.</p>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
