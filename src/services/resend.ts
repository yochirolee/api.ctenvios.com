import { Resend } from "resend";
const RESEND_API_KEY="re_Kf6hpAHi_H1hu9mydXZKzmHWm9KmZqtQr"

if (!RESEND_API_KEY) {
	console.error("RESEND_API_KEY environment variable is required");
}

export const resend = new Resend(RESEND_API_KEY);
