import { DataSource } from "typeorm";
import { createDataSourceOptionsFromEnv } from "../database/database.config";

async function main() {
  console.log("Database URL:", process.env.DATABASE_URL);
  const ds = new DataSource(createDataSourceOptionsFromEnv());
  await ds.initialize();
  try {
    const rows = await ds.query("SELECT id, mobile, expires_at, used FROM mobile_otp_challenges ORDER BY expires_at DESC LIMIT 5");
    console.log("Latest OTP Challenges in DB:");
    console.log(rows);
  } finally {
    await ds.destroy();
  }
}

main().catch(console.error);
