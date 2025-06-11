const Web3 = require("web3");
require("dotenv").config();

// Declare web3 variable in the global scope so it can be accessed by all functions
let web3;

// --- CONFIGURATION ---
const MIN_AMOUNT = 0.0012; // Minimum amount in ETH to send
const MAX_AMOUNT = 0.0023; // Maximum amount in ETH to send
const BATCH_SIZE = 10; // Number of addresses per batch
const MIN_BATCH_DELAY = 300000; // 5 minutes minimum delay between batches
const MAX_BATCH_DELAY = 600000; // 10 minutes maximum delay between batches
const MIN_TX_DELAY = 61000; // 61 seconds minimum delay between transactions
const MAX_TX_DELAY = 72000; // 72 seconds maximum delay between transactions
const ADDRESSES_PER_WALLET = 50; // Number of addresses to generate per wallet

// A list of public Sepolia RPCs to try connecting to
const SEPOLIA_RPCS = ["https://rpc.sepolia.org", "https://rpc2.sepolia.org", "https://eth-sepolia.public.blastapi.io", "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161"];

// --- HELPER FUNCTIONS ---

/**
 * Iterates through the SEPOLIA_RPCS list and returns the first working Web3 instance.
 * @returns {Promise<Web3>} A Web3 instance connected to a working RPC.
 * @throws {Error} If no working RPC is found.
 */
async function getWorkingRPC() {
  console.log("Searching for a working Sepolia RPC...");
  for (const rpc of SEPOLIA_RPCS) {
    try {
      const tempWeb3 = new Web3(rpc);
      // Check if the node is actively listening for connections
      const isConnected = await tempWeb3.eth.net.isListening();
      if (isConnected) {
        console.log(`Successfully connected to Sepolia using RPC: ${rpc}`);
        return tempWeb3;
      }
    } catch (error) {
      console.warn(`Failed to connect to RPC: ${rpc}. Trying next...`);
      continue;
    }
  }
  throw new Error("Could not find any working Sepolia RPCs.");
}

/**
 * Generates a single random Ethereum address.
 * @returns {string} A new Ethereum address.
 */
function generateRandomAddress() {
  // web3.eth.accounts.create() doesn't require a provider, so it's safe to use here.
  const account = web3.eth.accounts.create();
  return account.address;
}

/**
 * Generates a specified number of random Ethereum addresses.
 * @param {number} count - The number of addresses to generate.
 * @returns {string[]} An array of generated Ethereum addresses.
 */
function generateAddresses(count = ADDRESSES_PER_WALLET) {
  const addresses = [];
  for (let i = 0; i < count; i++) {
    addresses.push(generateRandomAddress());
  }
  return addresses;
}

/**
 * Generates a random number within a specified range.
 * @param {number} min - The minimum value.
 * @param {number} max - The maximum value.
 * @returns {number} A random number between min and max.
 */
function getRandomNumber(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Generates a random ETH amount and formats it to avoid precision issues.
 * @returns {number} A random ETH amount.
 */
function getRandomAmount() {
  const amount = getRandomNumber(MIN_AMOUNT, MAX_AMOUNT);
  // FIX: Limit the number of decimal places to avoid "too many decimal places" error from web3.
  // Numbers with too many decimals cannot be converted to 'wei' correctly.
  return parseFloat(amount.toFixed(8));
}

/**
 * Generates a random delay in milliseconds.
 * @param {number} min - The minimum delay in ms.
 * @param {number} max - The maximum delay in ms.
 * @returns {number} A random integer representing the delay in milliseconds.
 */
function getRandomDelay(min, max) {
  return Math.floor(getRandomNumber(min, max));
}

// --- CORE LOGIC ---

/**
 * Sends a specified amount of ETH from one address to another.
 * @param {string} fromAddress - The sender's Ethereum address.
 * @param {string} toAddress - The recipient's Ethereum address.
 * @param {number} amountEth - The amount of ETH to send.
 * @param {string} privateKey - The sender's private key.
 * @returns {Promise<object|null>} The transaction receipt if successful, otherwise null.
 */
async function sendEth(fromAddress, toAddress, amountEth, privateKey) {
  try {
    const amountWei = web3.utils.toWei(amountEth.toString(), "ether");
    const nonce = await web3.eth.getTransactionCount(fromAddress, "latest");
    const gasPrice = await web3.eth.getGasPrice();

    const transaction = {
      nonce: nonce,
      to: toAddress,
      value: amountWei,
      gas: 21000,
      gasPrice: gasPrice,
      chainId: 11155111, // Sepolia Chain ID
    };

    const signedTx = await web3.eth.accounts.signTransaction(transaction, privateKey);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    console.log(`Transaction successful! Hash: ${receipt.transactionHash}`);
    return receipt;
  } catch (error) {
    // Log a more detailed error message for easier debugging.
    console.error(`Error sending transaction to ${toAddress}: ${error.message}`);
    return null;
  }
}

/**
 * Sends ETH to a batch of addresses with a delay between each transaction.
 * @param {string[]} addresses - An array of recipient addresses.
 * @param {string} fromAddress - The sender's address.
 * @param {string} privateKey - The sender's private key.
 */
async function sendToBatch(addresses, fromAddress, privateKey) {
  console.log(`\nSending to batch of ${addresses.length} addresses...`);

  for (const address of addresses) {
    const randomAmount = getRandomAmount();
    console.log(`\nSending ${randomAmount.toFixed(8)} ETH to: ${address}`); // Display the rounded amount.
    await sendEth(fromAddress, address, randomAmount, privateKey);

    // Wait for a random delay before the next transaction in the same batch.
    const randomDelay = getRandomDelay(MIN_TX_DELAY, MAX_TX_DELAY);
    console.log(`Waiting ${(randomDelay / 1000).toFixed(1)} seconds before next transaction...`);
    await new Promise((resolve) => setTimeout(resolve, randomDelay));
  }
}

/**
 * Processes a single wallet: generates addresses, splits them into batches, and sends ETH.
 * @param {string} privateKey - The private key of the wallet to process.
 * @param {number} walletIndex - The index of the wallet for logging purposes.
 */
async function processWallet(privateKey, walletIndex) {
  try {
    // Ensure the private key has the '0x' prefix.
    const formattedPrivateKey = privateKey.startsWith("0x") ? privateKey : "0x" + privateKey;
    const fromAddress = web3.eth.accounts.privateKeyToAccount(formattedPrivateKey).address;
    const balance = await web3.eth.getBalance(fromAddress);
    const balanceEth = web3.utils.fromWei(balance, "ether");

    console.log(`\nWallet ${walletIndex + 1} - Address: ${fromAddress}`);
    console.log(`Balance: ${balanceEth} ETH`);

    // Generate a new set of random addresses for this wallet.
    const addresses = generateAddresses(ADDRESSES_PER_WALLET);
    console.log(`\nGenerated ${ADDRESSES_PER_WALLET} random addresses for wallet ${walletIndex + 1}.`);

    // Split addresses into smaller batches.
    const batches = [];
    for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
      batches.push(addresses.slice(i, i + BATCH_SIZE));
    }

    console.log(`\nStarting batch transactions for wallet ${walletIndex + 1}...`);
    for (let i = 0; i < batches.length; i++) {
      console.log(`\n--- Processing Batch ${i + 1} of ${batches.length} ---`);
      await sendToBatch(batches[i], fromAddress, formattedPrivateKey);

      // If it's not the last batch, wait for a longer delay.
      if (i < batches.length - 1) {
        const randomBatchDelay = getRandomDelay(MIN_BATCH_DELAY, MAX_BATCH_DELAY);
        console.log(`\nBatch complete. Waiting ${(randomBatchDelay / 1000 / 60).toFixed(1)} minutes before next batch...`);
        await new Promise((resolve) => setTimeout(resolve, randomBatchDelay));
      }
    }
    console.log(`\nAll batches completed for wallet ${walletIndex + 1}!`);
  } catch (error) {
    console.error(`An error occurred while processing wallet ${walletIndex + 1}:`, error.message);
  }
}

// --- MAIN EXECUTION ---

/**
 * Main function to orchestrate the entire process.
 */
async function main() {
  try {
    // 1. Find a working RPC and initialize web3.
    web3 = await getWorkingRPC();

    // 2. Read all private keys from the .env file.
    const privateKeys = [];
    let index = 1;
    while (true) {
      const key = process.env[`PRIVATE_KEY_${index}`];
      if (!key) break; // Exit loop if no more keys are found.

      const trimmedKey = key.trim();
      if (trimmedKey && trimmedKey.toLowerCase() !== "your_private_key_here") {
        privateKeys.push(trimmedKey);
      }
      index++;
    }

    if (privateKeys.length === 0) {
      console.error("Error: No valid private keys found in your .env file.");
      console.log("\nPlease create a .env file and add your keys like this:");
      console.log("PRIVATE_KEY_1=your_private_key_here");
      console.log("PRIVATE_KEY_2=your_other_private_key_here (optional)");
      return;
    }

    console.log(`\nFound ${privateKeys.length} wallet(s) to process.`);
    console.log("The script will process each wallet sequentially.");

    // 3. Process each wallet one by one.
    for (let i = 0; i < privateKeys.length; i++) {
      console.log(`\n================== Processing Wallet ${i + 1} of ${privateKeys.length} ==================`);
      await processWallet(privateKeys[i], i);

      // Wait before starting the next wallet, if there is one.
      if (i < privateKeys.length - 1) {
        const delayBetweenWallets = 300000; // 5 minutes
        console.log(`\nFinished wallet. Waiting 5 minutes before processing the next one...`);
        await new Promise((resolve) => setTimeout(resolve, delayBetweenWallets));
      }
    }

    console.log("\n================== All Wallets Processed! ==================");
  } catch (error) {
    console.error("\nA critical error occurred in the main process:", error.message);
  }
}

// Run the script
main().catch((error) => {
  // This catches any unhandled promise rejections from main()
  console.error("Script execution failed:", error);
});
