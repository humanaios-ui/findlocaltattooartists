const MESSAGES: Record<string, string> = {
  age: "Confirm that you are 18 or older before continuing.",
  rights: "Confirm that you have the right to publish the images, including client consent.",
  email: "Enter a valid email address.",
  "email-taken": "That email already has an account. Log in instead.",
  password: "Use a password of at least 8 characters.",
  credentials: "That email and password did not match.",
  name: "Enter a name between 2 and 80 characters.",
  city: "Choose Phoenix or Fort Walton Beach. Other cities are not listed.",
  zip: "That ZIP code is not in the selected city. Leave it blank or use a ZIP from that metro.",
  bio: "Write a bio of at least 40 characters.",
  styles: "Choose at least one style.",
  phone: "Enter a phone number, or choose email as the contact preference.",
  hours: "Add hours, or leave the default “By appointment”.",
  origin: "The form was submitted from an unexpected page. Try again.",
  auth: "Log in to do that.",
  forbidden: "That account cannot open this page.",
  image: "The image could not be saved.",
  "image-type": "Upload a WebP image. The form converts photos before sending them.",
  "image-size": "That file is empty, tiny, or still too large after compression.",
  "image-cap": "A listing can have up to 12 images.",
  alt: "Add a short description of the image.",
  tag: "Choose healed, fresh, or leave the tag unspecified.",
  booking: "That artist is not accepting public requests.",
  status: "That request can no longer be changed.",
  "not-found": "We could not find that.",
  report: "Describe the problem in at least 10 characters.",
  config: "The server is missing a required setting.",
  server: "Something went wrong. Try again.",
  "email-failed": "The request was saved, but the email could not be sent.",
  saved: "Saved.",
  sent: "Request sent. The artist has it, and a copy is in your email.",
  updated: "Updated.",
};

export function messageFor(code: string | null): string | null {
  if (!code) return null;
  return MESSAGES[code] ?? "Something went wrong. Try again.";
}
