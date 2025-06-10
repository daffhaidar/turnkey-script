const Web3 = require('web3');
require('dotenv').config();

// Configuration
const AMOUNT_TO_SEND = 0.0012; // Amount in ETH to send per address
const BATCH_SIZE = 10; // Number of addresses per batch
const DELAY_BETWEEN_BATCHES = 180000; // 180 seconds delay between batches
const DELAY_BETWEEN_TRANSACTIONS = 60000; // 60 seconds delay between transactions
const ADDRESSES_PER_WALLET = 50; // Number of addresses to generate per wallet

// Initialize Web3 with public Sepolia RPC
const SEPOLIA_RPCS = [
    'https://rpc.sepolia.org',
    'https://rpc2.sepolia.org',
    'https://eth-sepolia.public.blastapi.io',
    'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'
];

// Function to get working RPC
async function getWorkingRPC() {
    for (const rpc of SEPOLIA_RPCS) {
        try {
            const web3 = new Web3(rpc);
            const isConnected = await web3.eth.net.isListening();
            if (isConnected) {
                console.log(`Connected to Sepolia using RPC: ${rpc}`);
                return web3;
            }
        } catch (error) {
            continue;
        }
    }
    throw new Error('No working RPC found');
}

// Function to generate random Ethereum address
function generateRandomAddress() {
    const account = web3.eth.accounts.create();
    return account.address;
}

// Generate random addresses
function generateAddresses(count = ADDRESSES_PER_WALLET) {
    const addresses = [];
    for (let i = 0; i < count; i++) {
        addresses.push(generateRandomAddress());
    }
    return addresses;
}

// Function to send ETH
async function sendEth(fromAddress, toAddress, amountEth, privateKey) {
    try {
        const amountWei = web3.utils.toWei(amountEth.toString(), 'ether');
        const nonce = await web3.eth.getTransactionCount(fromAddress);
        const gasPrice = await web3.eth.getGasPrice();

        const transaction = {
            nonce: nonce,
            to: toAddress,
            value: amountWei,
            gas: 21000,
            gasPrice: gasPrice,
            chainId: 11155111 // Sepolia chain ID
        };

        const signedTx = await web3.eth.accounts.signTransaction(transaction, privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        console.log(`Transaction successful! Hash: ${receipt.transactionHash}`);
        return receipt;
    } catch (error) {
        console.log(`Error sending transaction: ${error.message}`);
        return null;
    }
}

// Function to send to batch of addresses
async function sendToBatch(addresses, fromAddress, privateKey) {
    console.log(`\nSending to batch of ${addresses.length} addresses...`);
    
    for (const address of addresses) {
        console.log(`\nSending to: ${address}`);
        await sendEth(fromAddress, address, AMOUNT_TO_SEND, privateKey);
        // 60 seconds delay between transactions in the same batch
        console.log(`Waiting ${DELAY_BETWEEN_TRANSACTIONS/1000} seconds before next transaction...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_TRANSACTIONS));
    }
}

// Function to process a single wallet
async function processWallet(privateKey, walletIndex) {
    try {
        // Add 0x prefix if not present
        const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
        
        // Get sender address from private key
        const fromAddress = web3.eth.accounts.privateKeyToAccount(formattedPrivateKey).address;
        
        // Check balance
        const balance = await web3.eth.getBalance(fromAddress);
        const balanceEth = web3.utils.fromWei(balance, 'ether');
        console.log(`\nWallet ${walletIndex + 1} - Address: ${fromAddress}`);
        console.log(`Balance: ${balanceEth} ETH`);

        // Generate addresses for this wallet
        const addresses = generateAddresses(ADDRESSES_PER_WALLET);
        console.log(`\nGenerated ${ADDRESSES_PER_WALLET} random Ethereum addresses for wallet ${walletIndex + 1}:`);
        addresses.forEach((addr, index) => {
            console.log(`${(index + 1).toString().padStart(2, '0')}. ${addr}`);
        });

        // Split addresses into batches
        const batches = [];
        for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
            batches.push(addresses.slice(i, i + BATCH_SIZE));
        }

        // Send to each batch with delay
        console.log(`\nStarting batch transactions for wallet ${walletIndex + 1}...`);
        
        for (let i = 0; i < batches.length; i++) {
            console.log(`\nBatch ${i + 1} (${batches[i].length} addresses):`);
            await sendToBatch(batches[i], fromAddress, formattedPrivateKey);
            
            if (i < batches.length - 1) {
                console.log(`\nWaiting ${DELAY_BETWEEN_BATCHES/1000} seconds before next batch...`);
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
            }
        }

        console.log(`\nAll batches completed for wallet ${walletIndex + 1}!`);
        
    } catch (error) {
        console.error(`Error processing wallet ${walletIndex + 1}:`, error.message);
    }
}

async function main() {
    try {
        // Get working RPC
        web3 = await getWorkingRPC();
        
        // Get all private keys from .env
        const privateKeys = [];
        let index = 1;
        let hasMoreKeys = true;

        while (hasMoreKeys) {
            const key = process.env[`PRIVATE_KEY_${index}`];
            if (!key) {
                hasMoreKeys = false;
            } else {
                const trimmedKey = key.trim();
                if (trimmedKey && trimmedKey !== 'your_private_key_here') {
                    privateKeys.push(trimmedKey);
                }
                index++;
            }
        }
        
        if (privateKeys.length === 0) {
            console.error("Error: No valid private keys found in .env file");
            console.log("\nPlease create a .env file with at least one private key:");
            console.log("PRIVATE_KEY_1=your_private_key_here");
            console.log("PRIVATE_KEY_2=your_private_key_here (optional)");
            console.log("PRIVATE_KEY_3=your_private_key_here (optional)");
            console.log("... and so on");
            return;
        }

        console.log(`\nFound ${privateKeys.length} valid wallet(s) to process`);
        console.log("Script will process all available wallets in sequence");

        // Process each wallet
        for (let i = 0; i < privateKeys.length; i++) {
            console.log(`\n=== Processing Wallet ${i + 1} of ${privateKeys.length} ===`);
            await processWallet(privateKeys[i], i);
            
            if (i < privateKeys.length - 1) {
                console.log(`\nWaiting 5 minutes before processing next wallet...`);
                await new Promise(resolve => setTimeout(resolve, 300000)); // 5 minutes delay between wallets
            }
        }

        console.log("\nAll available wallets processed successfully!");
        
    } catch (error) {
        console.error("Error:", error.message);
    }
}

main().catch(console.error); 