import { MongoClient, ServerApiVersion } from 'mongodb';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("❌ 找不到 MONGODB_URI，請確認 auth-server 資料夾內是否有 .env 檔案！");
  process.exit(1);
}

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

async function resetUserPassword(email, newPlainPassword) {
  try {
    console.log("⏳ 正在連線至 MongoDB...");
    await client.connect();
    const db = client.db('WebDemo');
    console.log("✅ 成功連線至資料庫！");

    const user = await db.collection('User').findOne({ email: email });
    
    if (!user) {
      console.log(`❌ 錯誤：資料庫中找不到信箱為 ${email} 的用戶。`);
      process.exit(1);
    }

    console.log(`⏳ 正在為 ${email} 生成新密碼...`);
    const hashedPassword = await bcrypt.hash(newPlainPassword, 10);

    await db.collection('User').updateOne(
      { email: email },
      { $set: { password: hashedPassword } }
    );

    console.log(`🎉 救援成功！`);
    console.log(`👉 已將用戶 ${email} 的密碼強制重置為: ${newPlainPassword}`);

  } catch (error) {
    console.error("❌ 執行過程中發生錯誤:", error);
  } finally {

    await client.close();
    process.exit(0);
  }
}

const targetEmail = 'test@gmail.com'; 
const newTempPassword = 'testtest'; 

resetUserPassword(targetEmail, newTempPassword);