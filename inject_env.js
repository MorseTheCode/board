const fs = require('fs');
const path = require('path');

const SECRET_NAME = 'FIREBASE_CONFIGS';
const PLACEHOLDER = '[[FIREBASE_CONFIGS_PLACEHOLDER]]';
const TARGET_FILE = 'index.html'; 

const configsJsonString = process.env[SECRET_NAME]; 
const filePath = path.join(__dirname, TARGET_FILE);

try {
    if (!configsJsonString) {
        throw new Error(`The Secret "${SECRET_NAME}" is not defined in the GitHub Actions environment.`);
    }

    let content = fs.readFileSync(filePath, 'utf8');

    if (!content.includes(PLACEHOLDER)) {
        throw new Error(`Placeholder "${PLACEHOLDER}" not found in file ${TARGET_FILE}.`);
    }

    content = content.replace(PLACEHOLDER, configsJsonString);

    fs.writeFileSync(filePath, content, 'utf8');

    console.log(`Success! Configuration variable (${SECRET_NAME}) injected into ${TARGET_FILE}.`);

} catch (error) {
    console.error("ERROR in Environment Variable Injection:");
    console.error(error.message);
    process.exit(1);

}
