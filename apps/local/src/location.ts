export const MAX_LOCATION = 80;

export const cleanLocation = (value: string): string => value.replace(/\s+/g, " ").trim().slice(0, MAX_LOCATION);

export function withLocation(question: string, location: string): string {
	return location ? `${question}\n\nI am in ${location}.` : question;
}
