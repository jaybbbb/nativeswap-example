let PRIVATE_KEY = "0000000000000000000000000000000000000000000000000000000000000000"; //replace your private key
const RPC_URL = "PROVIDE_RPC_URL";

const TX_MODE = "calldata";
// const TX_MODE = "contractParams";

const fetch = require("node-fetch");
const walletApi = require('ethereumjs-wallet').default;
const { Web3 } = require("web3");
const web3 = new Web3(RPC_URL);

const API_URL = "https://bridge.orbitchain.io/open/v1/api";

async function main() {
  PRIVATE_KEY = PRIVATE_KEY.replace("0x", "");
  const account = getWalletFromPK(Buffer.from(PRIVATE_KEY, "hex"));
  const from = account.address;

  // fetch nativeswap info. check eth to klaytn available.
  let info = await (await fetch(`${API_URL}/nativeswap/info`)).json();
  if (!info.success) {
    throw Error("fetch info fail.");
  }
  info = info.info;
  if (!info.eth || !info.eth.toChains.klaytn) {
    throw Error("currently nativeswap doesn't support eth to klaytn");
  }

  // fetch detailed native swap routes and estimated results by given params
  const amount = 0.001 * 10 ** 18; // 0.001 ETH in wei
  const params = new URLSearchParams({
    fromChain: "eth",
    toChain: "klaytn",
    amount,
    slippage: 0.3,
    contractAddr: ETH_CONTRACT_ADDR,
  });
  const optimizedRoute = await (await fetch(`${API_URL}/nativeswap?${params}`)).json();
  if (!optimizedRoute.success) {
    throw Error("fetch route fail.");
  }

  let signedTransaction;
  let txData = {
    from,
    to: ETH_CONTRACT_ADDR,
    value: `0x${amount.toString(16)}`,
    maxFeePerGas: `0x${(10 * 10 ** 9).toString(16)}`, // U should replace proper gas logic
    maxPriorityFeePerGas: `0x${(10 ** 9).toString(16)}`, // U should replace proper gas logic
    chainId: 1
  };

  let txHash;
  // send tx using call data.
  if (TX_MODE === "calldata") {
    txData.nonce = await getNonce(from);
    txData.gasLimit = 5 * 10 ** 5;
    txData.data = optimizedRoute.info.callData;
    signedTransaction = await web3.eth.accounts.signTransaction(txData, `0x${PRIVATE_KEY}`);
    const result = await web3.eth.sendSignedTransaction(signedTransaction.rawTransaction);
    txHash = result.transactionHash;
  }

  // send tx using contractParams.
  if (TX_MODE === "contractParams") {
    const contract = new web3.eth.Contract(ABI, ETH_CONTRACT_ADDR);
    txData.nonce = await getNonce(from);
    txData.gasLimit = await contract.methods.swapAndBridge(...optimizedRoute.info.contractParams).estimateGas(txData).catch(e => console.log(e));
    txData.gasLimit = parseInt(parseInt(txData.gasLimit) * 1.5);
    txData.data = await contract.methods.swapAndBridge(...optimizedRoute.info.contractParams).encodeABI();
    signedTransaction = await web3.eth.accounts.signTransaction(txData, `0x${PRIVATE_KEY}`);
    const result = await web3.eth.sendSignedTransaction(signedTransaction.rawTransaction);
    txHash = result.transactionHash;
  }

  console.log(txHash);

  // watching my request complete
  while(true) {
    const progress = await (await fetch(`${API_URL}/nativeswap/board/${txhash}/1`)).json();
    console.log(JSON.stringify(progress, null, 2));
    if (progress.list[0].thash_destination) {
      console.log("your asset arrived!!");
      process.exit(0);
    }
    await new Promise(r => setTimeout(r, 10 * 1000));
  }
}

const ETH_CONTRACT_ADDR = "0x7a8489367b668f89DEf930F94A560024E7474dCb";
const ABI = JSON.parse('[{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"dstBridge","type":"address"},{"indexed":false,"internalType":"address","name":"toAddress","type":"address"},{"indexed":false,"internalType":"address","name":"toToken","type":"address"},{"indexed":false,"internalType":"string","name":"toChain","type":"string"},{"indexed":false,"internalType":"uint256","name":"balance","type":"uint256"}],"name":"BridgeExecuted","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"string","name":"toChain","type":"string"},{"indexed":false,"internalType":"address","name":"dstSwap","type":"address"},{"indexed":false,"internalType":"address","name":"dstBridge","type":"address"},{"indexed":false,"internalType":"address","name":"fromAddress","type":"address"},{"indexed":false,"internalType":"address","name":"toAddress","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"bridgeAmount","type":"uint256"},{"indexed":false,"internalType":"address","name":"bridgeToken","type":"address"}],"name":"SwapAndBridge","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"dstSwap","type":"address"},{"indexed":false,"internalType":"address","name":"toToken","type":"address"},{"indexed":false,"internalType":"string","name":"toChain","type":"string"}],"name":"SwapExecuted","type":"event"},{"stateMutability":"payable","type":"fallback"},{"inputs":[{"internalType":"address","name":"_address","type":"address"},{"internalType":"bool","name":"_isValid","type":"bool"},{"internalType":"string","name":"_chain","type":"string"},{"internalType":"address","name":"_token","type":"address"}],"name":"addBridge","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_address","type":"address"}],"name":"addRouter","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"admin_","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"bridge","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"bridgeInfo","outputs":[{"internalType":"bool","name":"isValid","type":"bool"},{"internalType":"string","name":"toChain","type":"string"},{"internalType":"address","name":"token","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"feeRate","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"feeReceiver","outputs":[{"internalType":"address payable","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getBridge","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getRouter","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"isOrbitBridge","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"isValidRouter","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"","type":"string"}],"name":"limit","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner_","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_address","type":"address"}],"name":"removeBridge","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_address","type":"address"}],"name":"removeRouter","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"router","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address payable","name":"_address","type":"address"},{"internalType":"uint256","name":"_feeRate","type":"uint256"}],"name":"setFeeInfo","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"_chain","type":"string"},{"internalType":"uint256","name":"_limit","type":"uint256"},{"internalType":"bool","name":"isMax","type":"bool"}],"name":"setLimit","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_address","type":"address"},{"internalType":"bool","name":"_isOrbitBridge","type":"bool"}],"name":"setOrbitBridge","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"_sig","type":"bytes4"},{"internalType":"bool","name":"_bool","type":"bool"}],"name":"setSigs","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"","type":"bytes4"}],"name":"sigs","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"minSwapAmount","type":"uint256"},{"internalType":"address","name":"dstSwap","type":"address"},{"internalType":"bytes","name":"swapData","type":"bytes"},{"internalType":"address","name":"dstBridge","type":"address"}],"name":"swapAndBridge","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"version","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"pure","type":"function"},{"stateMutability":"payable","type":"receive"}]');

function getNonce(addr) {
  return new Promise((resolve, reject) => {
    web3.eth.getTransactionCount(addr, "pending").then(n => {
      resolve(n);
    }).catch(e => {
      reject(e);
    });
  });
}

function getWalletFromPK(pk) {
  let wallet = walletApi.fromPrivateKey(pk);
  return {
      address: wallet.getAddressString(),
      addressBuffer: wallet.getAddress(),
      pk: wallet.getPrivateKey().toString('hex'),
      pkBuffer: wallet.getPrivateKey()
  }
}

main();