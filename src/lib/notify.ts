import { randomToken } from "./auth/webcrypto";
import { createNotificationProvider, type EmailMessage } from "./email/provider";
import { readEnv } from "./mode";
import type { DataRepository } from "./types";

export async function deliver(messages: EmailMessage[], repo: DataRepository, demo: boolean): Promise<void> {
  const provider = createNotificationProvider(readEnv());
  for (const message of messages) {
    await provider.send(message);
    if (demo) {
      await repo.logEmail({
        id: randomToken(),
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        createdAt: new Date().toISOString(),
      });
    }
  }
}

export async function tryDeliver(messages: EmailMessage[], repo: DataRepository, demo: boolean): Promise<boolean> {
  try {
    await deliver(messages, repo, demo);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}
