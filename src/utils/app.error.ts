// utils/AppError.ts
export class AppError extends Error {
	public statusCode: number;
	public details?: any;
	public type?: string;

	constructor(message: string, statusCode = 400, details?: any, type?: string) {
		super(message);
		this.statusCode = statusCode;
		this.details = details;
		this.type = type;
	}
}

export default AppError;
