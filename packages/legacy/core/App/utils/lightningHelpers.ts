import { EnvironmentType, NodeConfigVariant, PaymentStatus, connect, defaultConfig, mnemonicToSeed, nodeInfo, receiveOnchain, receivePayment, sendPayment, paymentByHash, sendSpontaneousPayment, listLsps } from "@breeztech/react-native-breez-sdk";
import { getItem, setItem } from "./storage";
import { generateMnemonic } from "@dreson4/react-native-quick-bip39";
import { t } from "i18next";
import * as lightningPayReq from 'bolt11';
import * as base64 from 'byte-base64';
import Config from "react-native-config";

const MNEMONIC_STORE = "MNEMONIC_SECURE_STORE"

export const initNodeAndSdk = async (eventHandler: any, restoreMnemonic: string | undefined = undefined) => {
    try {
        let seed = <any>[];
        let mnemonic
        let nodeConfig
        const apiKey = Config.BREEZ_API_KEY;

        // const apiKey = 'Yk2YFZixwFZai/af49/A/1W1jtPx28MV6IXH8DIzvG0=';
        if (restoreMnemonic) {

            seed = await mnemonicToSeed(restoreMnemonic);
            mnemonic = restoreMnemonic

            nodeConfig = {
                type: NodeConfigVariant.GREENLIGHT,
                config: { partnerCredentials: { deviceCert: [], deviceKey: [] } }
            };
            console.log("Using restore mnemonic")
        }
        else {
            mnemonic = await getItem(MNEMONIC_STORE)
            if (!mnemonic) {
                console.log("No mnemonic found, generating new one");
                mnemonic = generateMnemonic();
                console.log("Generated mnemonic: ", mnemonic);
            }
            else {
                console.log("Mnemonic found: ", mnemonic);
            }

            seed = await mnemonicToSeed(mnemonic);
            const keys = convertCerts();

            if (keys !== undefined && keys.deviceCert !== undefined && keys.deviceKey !== undefined) {
                const partnerCreds = { deviceCert: keys.deviceCert, deviceKey: keys.deviceKey };
                nodeConfig = {
                    type: NodeConfigVariant.GREENLIGHT,
                    config: { partnerCredentials: partnerCreds }
                };
                console.log("Going with partner credentials")
            }
        }

        console.log("Seed: ", seed);

        if (nodeConfig && apiKey) {
            const config = await defaultConfig(
                EnvironmentType.PRODUCTION,
                apiKey,
                nodeConfig
            );
            const eventSubscription = await connect(config, seed, eventHandler);
            console.log('Breez Initialized');
            await setItem(MNEMONIC_STORE, mnemonic);
            return eventSubscription
        }
        else {
            console.error("No node config found")
        }
    }
    catch (err: any) {
        const errorString = JSON.stringify(err)

        if (errorString.includes("already initialized")) {
            console.log("Breez already initialized.")
            return undefined
        }

        let errorMessage = "Error initializing wallet."
        if (err?.message) {
            errorMessage = errorMessage + " Details: " + err.message
        }
        return JSON.stringify(errorMessage)
    }
}

export const breezInitHandler = async (event: any, mnemonic: string | undefined = undefined) => {
    try {
        const retries = 10;
        let retryCount = 0;

        while (retryCount < retries) {
            const res = await initNodeAndSdk(event, mnemonic);

            if (typeof res === 'string' && JSON.stringify(res).includes("os error")) {
                retryCount++;
                console.log("Retrying Breez initialization")
            } else {
                return res
            }
        }

        return "Error initializing wallet."

    } catch (err: any) {
        console.error(err);
        let errorMessage = "Error initializing wallet."
        if (err?.message) {
            errorMessage = errorMessage + " Details: " + err.message
        }
        return JSON.stringify(errorMessage)
    }
}

const convertCerts = () => {
    try {
        if (Config.GREENLIGHT_CERT === undefined || Config.GREENLIGHT_KEY === undefined) {
            console.error("No certificates found");
            return undefined
        }
        const deviceCert =
            Array.from(base64.base64ToBytes(Config.GREENLIGHT_CERT));
        const deviceKey =
            Array.from(base64.base64ToBytes(Config.GREENLIGHT_KEY));

        return { deviceCert, deviceKey };

    } catch (error: any) {
        console.error('Error converting certificates:', error);
    }
};

export const getBalances = async () => {
    try {
        const nodeStateRes = await nodeInfo();
        console.log("Node state response: ", nodeStateRes);
        const channelBalance = nodeStateRes?.channelsBalanceMsat;
        console.log("Channel balance: ", channelBalance);
        const chainBalance = nodeStateRes?.onchainBalanceMsat;
        console.log("Chain balance: ", chainBalance);
        // addLog({ channelBalance, chainBalance });

        return { channelBalance, chainBalance }
    } catch (err: any) {
        console.error(err);
        return err.message
        // addLog(err.message);
    }
}

export const getNodeId = async () => {
    try {
        const nodeStateRes = await nodeInfo();
        console.log("Node state response: ", nodeStateRes);
        const nodeId = nodeStateRes?.id;
        console.log("Node ID: ", nodeId);

        return nodeId
    } catch (err: any) {
        console.error(err);
        return undefined
    }
}

export const getBTCDepositInfo = async () => {
    try {
        const swapInfo = await receiveOnchain({});
        console.log("Deposit info: ", swapInfo);
        // addLog(swapInfo.bitcoinAddress);
        return { swapInfo }
    } catch (err: any) {
        console.error(err);
        return err.message
        // addLog(err.message);
    }
}

export const getInvoice = async (satsAmount: string) => {
    try {
        const receivePaymentResponse = await receivePayment({
            amountMsat: Number(satsAmount) * 1000,
            description: `Invoice for ${satsAmount} sats`,
        })

        //addLog(receivePaymentResponse.lnInvoice);
        console.log('Invoice:', receivePaymentResponse.lnInvoice)
        return receivePaymentResponse.lnInvoice
    } catch (err: any) {
        console.error(err)
        return "An error occurred while generating the invoice"
        // addLog(err.message);
    }
}

export const payInvoice = async (scannedData: any) => {
    try {
        const bolt11 = scannedData
        // The `amountMsat` param is optional and should only passed if the bolt11 doesn't specify an amount.
        // The amountMsat is required in case an amount is not specified in the bolt11 invoice'.
        // const amountMsat = 3000000
        if (bolt11 !== undefined) {

            const response = await sendPayment({ bolt11 })

            console.log('Payment response:', response)

            return response
        } else {
            console.log('No invoice to pay')
            return 'No invoice to pay'
        }
    } catch (err: any) {
        console.error(err)
        return err.message
    }
}

export const invoicePaymentHandler = async (scannedData: any) => {
    try {
        const retries = 3;
        let retryCount = 0;
        let res;
        while (retryCount < retries) {
            res = await payInvoice(scannedData);

            const responseString = JSON.stringify(res)
            if (responseString.includes("transport error") ||
                responseString.includes("out of routes to try after 2 attempts") ||
                responseString.includes("is not reachable directly and all routehints were unusable") ||
                responseString.includes("No such file or directory")) {

                retryCount++;
                console.log("Retrying payment")
                // Wait 2 seconds before retrying
                await new Promise(r => setTimeout(r, 2000));
            } else {
                return res
            }
        }
        return res

    } catch (err: any) {
        console.error(err);
        return JSON.stringify(err)
    }
}


export const checkStatus = async (hash: string) => {
    try {
        console.log('Checking payment status for hash:', hash)
        const paymentInfo = await paymentByHash(hash)

        console.log('Status:', paymentInfo)

        if (paymentInfo?.status === PaymentStatus.COMPLETE) {
            console.log('Payment Completed');
            return 'Payment Completed';
        }
        else if (paymentInfo?.status === PaymentStatus.FAILED) {
            console.log('Payment failed');
            return ('Payment Failed');
        }
        else if (paymentInfo?.status === PaymentStatus.PENDING) {
            console.log('Payment pending');
            return ('Payment Pending');
        }
        else if (paymentInfo === null) {
            console.log(paymentInfo);

            return ('Payment not Completed');
        }
        else {
            console.log(paymentInfo);
            return ('Payment status unknown');
        }
    }
    catch (err: any) {
        console.error("Error checking payment status:", err)
        console.error(err)
        return String(err.message)
    }
}

export const payInvoiceWithAmount = async (scannedData: any, amount: number) => {

    try {
        const bolt11 = scannedData
        // The `amountMsat` param is optional and should only passed if the bolt11 doesn't specify an amount.
        // The amountMsat is required in case an amount is not specified in the bolt11 invoice'.
        const amountMsat = amount * 1000
        if (bolt11 !== undefined && amountMsat !== undefined) {

            const response = await sendPayment({ bolt11, amountMsat })

            console.log('Payment response:', response)

            return response
        } else {
            console.log('No invoice to pay')
            return 'No invoice to pay'
        }
    } catch (err: any) {
        console.error(err)
        return "Error paying invoice"
    }
}

export const sendSpontaneousPaymentToNode = async (nodeId: string, amount: number) => {
    try {
        const response = await sendSpontaneousPayment({ nodeId, amountMsat: amount * 1000 })

        console.log('Spontaneous payment response:', response)

        return response
    } catch (err: any) {
        console.error(err)
        return err.message
    }
}

export const getBTCPrice = async () => {
    try {
        let btcZarPrice = undefined;
        await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=zar')
            .then(response => response.json())
            .then(data => { console.log(data.bitcoin.zar); btcZarPrice = data.bitcoin.zar })
            .catch(error => console.error('Error:', error));

        return btcZarPrice
    } catch (error) {
        console.error('Error fetching btc price:', error);
    }
}

export const getLInvoiceZarAmount = async (lightningInvoice: string) => {
    const btcZarPrice = await getBTCPrice();

    try {
        if (btcZarPrice !== undefined) {
            return (Number(lightningPayReq.decode(lightningInvoice).millisatoshis) / 100000000000 * btcZarPrice).toFixed(2)
        }
        else {
            return undefined
        }
    } catch (error) {
        console.error('Error getting invoice amount:', error);
    }

}

export const getBTCToZarAmount = async (satoshis: number) => {
    const btcZarPrice = await getBTCPrice();

    try {
        if (btcZarPrice !== undefined) {
            return (satoshis / 100000000 * btcZarPrice).toFixed(2)
        }
        else {
            return undefined
        }
    } catch (error) {
        console.error('Error getting zar amount:', error);
    }

}

export const getZarToBTCAmount = async (zar: number) => {

    const btcZarPrice = await getBTCPrice();

    try {
        if (btcZarPrice !== undefined) {
            const btcAmount = (zar / btcZarPrice);
            const satoshis = Math.round(btcAmount * 100000000);
            return satoshis;
        }
        else {
            return undefined
        }
    } catch (error) {
        console.error('Error getting btc amount:', error);
    }
}

export const getLSPInfo = async () => {
    try {
        const availableLsps = await listLsps()
        return JSON.stringify(availableLsps)
    } catch (err) {
        console.error(err)
    }
}

export const getMnemonic = async () => {
    try {
        const seedPhrase = await getItem(MNEMONIC_STORE);
        return seedPhrase;

    } catch (err: any) {
        console.error(err);
    }
}

export const checkMnemonic = async () => {
    try {
        const seedPhrase = await getItem(MNEMONIC_STORE);
        if (seedPhrase) {
            return true
        }
        else {
            return false
        }

    } catch (err: any) {
        console.error(err);
    }
}

// enum with options for bitcoin and zar
export enum Currency {
    BITCOIN = 'Bitcoin (Satoshis)',
    ZAR = 'ZAR (South African Rand)'
}