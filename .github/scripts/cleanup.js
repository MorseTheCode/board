const admin = require('firebase-admin');

async function testConnection() {
  try {

    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    const db = admin.firestore();
    console.log('Firebase Admin initialized successfully.');

    // --- INÍCIO DO TESTE DE PING ---
    console.log('Attempting to list root collections (ping test)...');
    const collections = await db.listCollections();
    
    if (collections.length === 0) {
      console.log('Ping test SUCCESSFUL, but no collections found at the root.');
      console.log('This means AUTHENTICATION IS WORKING.');
    } else {
      console.log('Ping test SUCCESSFUL. Found collections:');
      collections.forEach(col => console.log(`- ${col.id}`));
      console.log('This means AUTHENTICATION IS WORKING.');
    }
    // --- FIM DO TESTE DE PING ---

    // O resto do seu script (não precisamos dele para este teste)
    console.log('Skipping cleanup logic for this test.');
    process.exit(0); // Sai com sucesso

  } catch (error) {
    console.error('Error during script execution:', error);
    process.exit(1); 
  }
}

testConnection();
