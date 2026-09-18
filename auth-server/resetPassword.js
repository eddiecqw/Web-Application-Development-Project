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
    console.log("⏳ Connecting to MongoDB...");
    await client.connect();
    const db = client.db('WebDemo');
    console.log("✅ Successfully connect to database！");

    const user = await db.collection('User').findOne({ email: email });
    
    if (!user) {
      console.log(`❌ Error：Couldn't find the user ${email} in the database.`);
      process.exit(1);
    }

    console.log(`⏳ Generating new password for user ${email} ...`);
    const hashedPassword = await bcrypt.hash(newPlainPassword, 10);

    await db.collection('User').updateOne(
      { email: email },
      { $set: { password: hashedPassword } }
    );

    console.log(`🎉 Rescue successfully.`);
    console.log(`👉 The password for user ${email} has been forcibly reset to: ${newPlainPassword}`);

  } catch (error) {
    console.error("❌ An error occurred during execution:", error);
  } finally {

    await client.close();
    process.exit(0);
  }
}

const targetEmail = 'test@gmail.com'; 
const newTempPassword = 'testtest'; 

resetUserPassword(targetEmail, newTempPassword);