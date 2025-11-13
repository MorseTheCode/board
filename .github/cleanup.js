const admin = require('firebase-admin');

async function cleanupStaleNicknames() {
  try {

    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    const db = admin.firestore();
    console.log('Firebase Admin initialized successfully.');

    const STALE_THRESHOLD_MINUTES = 2; 
    const threshold = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);

    const appId = 'evidence-board'; 

    const nicknamesCol = db.collection('artifacts').doc(appId)
                           .collection('public').doc('data')
                           .collection('nicknamePasswords');

    const query = nicknamesCol
      .where('currentUserId', '!=', null)
      .where('last_seen', '<', threshold);

    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log('No stale nicknames found. Exiting.');
      return;
    }

    console.log(`Found ${snapshot.size} stale nickname(s) to release...`);

    const batch = db.batch();
    snapshot.forEach(doc => {
      console.log(`- Releasing nickname: ${doc.id}`);

      batch.update(doc.ref, {
        currentUserId: admin.firestore.FieldValue.delete()
      });
    });

    await batch.commit();
    console.log('Successfully released all stale nicknames.');

  } catch (error) {
    console.error('Error during cleanup script execution:', error);
    process.exit(1); 
  }
}

cleanupStaleNicknames();
