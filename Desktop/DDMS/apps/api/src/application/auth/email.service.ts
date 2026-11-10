import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string | undefined;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const port = Number(config.get<string>('SMTP_PORT', '587'));
    const user = config.get<string>('SMTP_USER');
    const password = config.get<string>('SMTP_PASSWORD');
    this.from = config.get<string>('SMTP_FROM');

    this.transporter =
      host && Number.isInteger(port) && port > 0 && user && password
        ? nodemailer.createTransport({
            host,
            port,
            secure: config.get<string>('SMTP_SECURE') === 'true',
            auth: { user, pass: password },
          })
        : null;
  }

  assertConfigured(): void {
    this.getConfiguration();
  }

  private getConfiguration(): { transporter: Transporter; from: string } {
    if (!this.transporter || !this.from) {
      throw new ServiceUnavailableException(
        'SMTP email delivery is not configured.',
      );
    }
    return { transporter: this.transporter, from: this.from };
  }

  async sendVerificationEmail(to: string, token: string, frontendUrl: string) {
    const { transporter, from } = this.getConfiguration();

    const verificationUrl = new URL('/auth/verify-email', frontendUrl);
    verificationUrl.hash = new URLSearchParams({ token }).toString();

    try {
      await transporter.sendMail({
        from,
        to,
        subject: 'Verify your DDMS email address',
        text: `Verify your email address by opening this link: ${verificationUrl.toString()}`,
        html: `<p>Verify your email address to activate your DDMS account.</p><p><a href="${verificationUrl.toString()}">Verify email address</a></p>`,
      });
    } catch (error) {
      this.logger.error(
        'SMTP verification email delivery failed.',
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        'Verification email could not be sent. Please request a new link.',
      );
    }
  }

  async sendNotification(
    to: string,
    notificationId: string,
    title: string,
    body: string,
  ): Promise<void> {
    const { transporter, from } = this.getConfiguration();

    try {
      await transporter.sendMail({
        from,
        to,
        messageId: `<ddms-notification-${notificationId}@localhost>`,
        headers: { 'X-DDMS-Notification-ID': notificationId },
        subject: `DDMS: ${title}`,
        text: body,
        html: `<h1>${this.escapeHtml(title)}</h1><p>${this.escapeHtml(body)}</p>`,
      });
    } catch (error) {
      this.logger.error(
        `SMTP notification ${notificationId} delivery failed.`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        'Notification email could not be sent.',
      );
    }
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return entities[character]!;
    });
  }
}
