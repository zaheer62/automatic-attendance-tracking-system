import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(os.getenv("DATABASE_URL"))
cur = conn.cursor()
cur.execute("ALTER TABLE alert_configs ADD COLUMN IF NOT EXISTS email_address VARCHAR")
cur.execute("ALTER TABLE alert_configs ADD COLUMN IF NOT EXISTS phone_number VARCHAR")
conn.commit()
cur.close()
conn.close()
print("Done!")