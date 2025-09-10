import snowflake from "snowflake-sdk";

export function getConnection() {
  const conn = snowflake.createConnection({
    account: process.env.SNOWFLAKE_ACCOUNT,
    username: process.env.SNOWFLAKE_USERNAME,
    password: process.env.SNOWFLAKE_PASSWORD,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE,
    database: process.env.SNOWFLAKE_DATABASE,
    schema: process.env.SNOWFLAKE_SCHEMA,
    role: process.env.SNOWFLAKE_ROLE
  });
  return new Promise((resolve, reject) => {
    conn.connect(err => (err ? reject(err) : resolve(conn)));
  });
}

export async function exec(conn, sqlText, binds = []) {
  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText, binds,
      complete: (err, stmt, rows) => (err ? reject(err) : resolve(rows))
    });
  });
}
