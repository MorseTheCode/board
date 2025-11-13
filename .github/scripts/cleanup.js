const admin = require('firebase-admin');

async function cleanupStaleNicknames() {
  try {
    // 1. Initialize Firebase Admin
    // Ensure FIREBASE_SERVICE_ACCOUNT is set in your environment variables
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    
    // Check if app is already initialized to avoid errors on hot-reloads
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }

    const db = admin.firestore();
    console.log('Firebase Admin initialized successfully.');

    // 2. Define Stale Threshold
    const STALE_THRESHOLD_MINUTES = 1; // 1 minute for testing, you may want this higher
    const threshold = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);

    const appId = 'evidence-board'; // As defined in your app

    // 3. Find Stale Nicknames
    const nicknamesCol = db.collection('artifacts').doc(appId)
                           .collection('public').doc('data')
                           .collection('nicknamePasswords');

    const staleNicknamesQuery = nicknamesCol
      .where('currentUserId', '!=', null)
      .where('last_seen', '<', threshold);

    const snapshot = await staleNicknamesQuery.get();

    if (snapshot.empty) {
      console.log('No stale nicknames found. Exiting.');
      return;
    }

    console.log(`Found ${snapshot.size} stale nickname(s) to process...`);

    // 4. Get reference to the 'users' collection group
    const allUsersCollectionGroup = db.collectionGroup('users');

    // 5. Process each stale nickname individually
    for (const staleNicknameDoc of snapshot.docs) {
      const nickname = staleNicknameDoc.id;
      const currentUserId = staleNicknameDoc.data().currentUserId;
      console.log(`- Processing stale nickname: ${nickname} (user: ${currentUserId})`);

      let batch = db.batch();
      let batchCounter = 0;
      const BATCH_LIMIT = 499; // 499 to leave room for the nickname update

      try {
        // 6. Find all users with this nickname in any board
        const usersToUpdateQuery = allUsersCollectionGroup.where('nickname', '==', nickname);
        const usersToUpdateSnapshot = await usersToUpdateQuery.get();

        if (!usersToUpdateSnapshot.empty) {
          console.log(`  - Found ${usersToUpdateSnapshot.size} user(s) with this nickname across all boards.`);
          
          usersToUpdateSnapshot.forEach(userDoc => {
            console.log(`    - Queuing DELETION for user at path: ${userDoc.ref.path}`);
            batch.delete(userDoc.ref); // <-- Changed from update to delete
            batchCounter++;

            // 7. Handle batch size limit
            if (batchCounter >= BATCH_LIMIT) {
              batch.commit();
              console.log(`    - Committed batch of ${batchCounter} user deletions.`);
              batch = db.batch(); // Start a new batch
              batchCounter = 0;
            }
          });
        }

        // 8. Add the final nickname release to the current batch
        console.log(`  - Queuing release for nickname: ${nickname}`);
        batch.update(staleNicknameDoc.ref, {
          currentUserId: admin.firestore.FieldValue.delete()
        });
        batchCounter++;

        // 9. Commit the remaining operations
        if (batchCounter > 0) {
          await batch.commit();
          console.log(`  - Successfully committed final batch of ${batchCounter} operations for nickname ${nickname}.`);
        }

      } catch (err) {
        console.error(`  - Error processing nickname ${nickname}:`, err.message);
        // Continue to the next nickname
      }
    }

    console.log('All stale nicknames processed.');

  } catch (error) {
    console.error('Error during cleanup script execution:', error);
    process.exit(1);
  }
}

// Run the function
cleanupStaleNicknames().then(() => {
    console.log('Script finished.');
    // Close the app if it was initialized here, to allow the script to exit
    if (admin.apps.length) {
        admin.app().delete();
    }
}).catch(() => {
    process.exit(1);
});
