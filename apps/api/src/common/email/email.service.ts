import { Injectable } from "@nestjs/common";
import { Resend } from "resend";

import { ConfigService } from "../../config/config.service";
import { LoggerService } from "../logger/logger.service";

/** Resend-documented onboarding address for API testing when `RESEND_FROM` is unset. */
const RESEND_ONBOARDING_FROM = "onboarding@resend.dev";

@Injectable()
export class EmailService {
  private readonly resend: Resend | null;

  constructor(
    private readonly configService: ConfigService,
    private readonly loggerService: LoggerService
  ) {
    const apiKey = this.configService.getResendApiKey();
    this.resend = apiKey !== "" ? new Resend(apiKey) : null;
  }

  async sendVerificationEmail(to: string, codeOrLink: string): Promise<void> {
    const toTrimmed = to.trim();
    if (toTrimmed === "") {
      this.loggerService.warn("email_send_skipped_empty_to", {});
      return;
    }

    const apiKey = this.configService.getResendApiKey();
    if (apiKey === "" || this.resend === null) {
      this.loggerService.warn("email_send_skipped_no_resend_api_key", { to: toTrimmed });
      return;
    }

    const configuredFrom = this.configService.getResendFrom();
    const from = configuredFrom !== "" ? configuredFrom : RESEND_ONBOARDING_FROM;

    const escaped = codeOrLink.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const base = this.configService.getFrontendBaseUrl();
    let linkParagraph = "";
    if (base !== "") {
      try {
        const relative = `settings?verify_email_token=${encodeURIComponent(codeOrLink)}`;
        const u = new URL(relative, base.endsWith("/") ? base : `${base}/`);
        if (u.protocol === "http:" || u.protocol === "https:") {
          const href = u.href.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
          linkParagraph = `<p><a href="${href}">Open settings to verify your email</a></p>`;
        }
      } catch {
        /* malformed FRONTEND_BASE_URL — skip link */
      }
    }
    const html = `<p>Verify your email using this token:</p><p><strong>${escaped}</strong></p>${linkParagraph}`;

    try {
      const { data, error } = await this.resend.emails.send({
        from,
        to: [toTrimmed],
        subject: "Verify your email",
        html
      });
      if (error) {
        this.loggerService.error("email_send_resend_error", {
          to: toTrimmed,
          resend_message: error.message
        });
        return;
      }
      this.loggerService.info("email_send_verification_ok", { to: toTrimmed, id: data?.id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.loggerService.error("email_send_verification_failed", { to: toTrimmed, message });
    }
  }
}
