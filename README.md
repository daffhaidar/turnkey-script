# Sepolia ETH Sender Script

Script to send ETH to multiple random addresses on the Sepolia testnet using multiple wallets.

## Features

* Supports unlimited number of wallets (can be 1, 10, 100, or more)
* Each wallet will send to 50 random addresses
* Sends 0.0012 ETH to each address
* 180 seconds delay between batches
* 60 seconds delay between transactions in the same batch
* 5 minutes delay between wallets
* Checks balance of each wallet before transactions
* Handles nonce automatically
* Confirms transactions and displays transaction hashes

## Installation

Clone repository and install dependencies:

```bash
git clone https://github.com/daffhaidar/turnkey-script.git
cd sepolia-eth-sender
npm install
```

## Usage

1. Create a `.env` file and add private keys for the wallets you want to use:
```
# Minimum 1 private key, can add more as needed
PRIVATE_KEY_1=your_first_private_key_here
PRIVATE_KEY_2=your_second_private_key_here
PRIVATE_KEY_3=your_third_private_key_here
PRIVATE_KEY_4=your_fourth_private_key_here
PRIVATE_KEY_5=your_fifth_private_key_here
PRIVATE_KEY_6=your_sixth_private_key_here
# ... and so on
```

2. Run the script:
```bash
node send_eth.js
```

## How It Works

The script will perform the following:

1. Connect to Sepolia testnet using public RPC
2. Detect all available private keys from the .env file
3. For each available wallet:
   - Check wallet balance
   - Generate 50 random valid Ethereum addresses
   - Split addresses into batches (10 addresses per batch)
   - Send 0.0012 ETH to each address with delays:
     - 60 seconds between transactions in the same batch
     - 180 seconds between batches
   - Wait 5 minutes before processing the next wallet
4. Display transaction hashes and confirmations for each transaction

## Security Notes

⚠️ **IMPORTANT**: Never share or commit your private keys. This script uses a `.env` file to store your private keys.

## Troubleshooting

* If you encounter RPC errors, the script will automatically try other RPCs
* Make sure each wallet has enough ETH to cover all transactions plus gas fees
* Total time needed to send to all addresses: about 2 hours 30 minutes per wallet
* The script will process all available wallets in the .env file sequentially

## License

MIT 
