import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
	throw new Error("RESEND_API_KEY environment variable is required");
}

export const resend = new Resend(resendApiKey);
