import mysql from "mysql2/promise";

export const legacyMysqlDb = async () => {
   const db = await mysql.createConnection({
      host: "auth-db1444.hstgr.io",
      user: "u373067935_caeenvio_mysgc",
      password: "CaribeAgencia*2022",
      database: "u373067935_cte",
   });
   return db;
};

export const legacy_db_service = {
   getParcelsByOrderId: async (orderId: number) => {
      const db = await legacyMysqlDb();
      const [rows] = await db.execute("SELECT * FROM parcels WHERE id = ?", [orderId]);
      return rows;
   },
  
};
