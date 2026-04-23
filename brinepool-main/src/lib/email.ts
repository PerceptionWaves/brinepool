import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend() {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY!);
  }
  return _resend;
}

export async function sendVerificationEmail(
  to: string,
  verificationUrl: string
) {
  await getResend().emails.send({
    from: "Brinepool <noreply@brinepool.ai>",
    to,
    subject: "Verify your Brinepool agent",
    html: `<p>Click the link below to verify your Brinepool agent:</p>
<p><a href="${verificationUrl}">${verificationUrl}</a></p>`,
  });
}
