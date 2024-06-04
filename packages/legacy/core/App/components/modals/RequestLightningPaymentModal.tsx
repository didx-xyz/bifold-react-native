// RequestPaymentModal.tsx
import React from 'react';
import { SelectList } from 'react-native-dropdown-select-list'
import { Modal, View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Currency } from '../../utils/lightningHelpers';
// Import your theme or any other necessary elements here
import { theme as globalTheme } from '../../theme';

interface RequestPaymentModalProps {
    showRequestLightningPaymentModal: boolean;
    setShowRequestLightningPaymentModal: (show: boolean) => void;
    currencyAmount: string;
    setCurrencyAmount: (amount: string) => void;
    btcZarPrice?: number;
    currencyType: Currency;
    setCurrencyType: (type: Currency) => void;
    invoiceGenLoading: boolean;
    handleGetInvoiceButtonPress: () => void;
    paymentStatusDesc?: string;
    startingNode?: boolean; // Assuming startingNode might be a prop as well
    breezInitializing: boolean;
    eventHandler: any;
}

const RequestPaymentModal: React.FC<RequestPaymentModalProps> = ({
    showRequestLightningPaymentModal,
    setShowRequestLightningPaymentModal,
    currencyAmount,
    btcZarPrice,
    setCurrencyAmount,
    currencyType,
    setCurrencyType,
    invoiceGenLoading,
    handleGetInvoiceButtonPress,
    paymentStatusDesc,
    startingNode,
    breezInitializing,
    eventHandler,
}) => {

    const checkIfBTCPriceWasFetched = () => {
        return btcZarPrice === undefined && currencyType === Currency.ZAR || btcZarPrice === -1 && currencyType === Currency.ZAR
    }

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={showRequestLightningPaymentModal}
            onRequestClose={() => {
                setShowRequestLightningPaymentModal(false);
            }}
        >
            <View style={globalTheme.ChatTheme.paymentModals.modalView}>
                <Text style={{ ...globalTheme.TextTheme.headerTitle, marginTop: 20 }}>Request Payment</Text>

                {/* Show if node is busy initializing */}
                {breezInitializing ? (
                    <View style={globalTheme.ChatTheme.paymentModals.breezInitView}>
                        <Text style={{ color: '#fff', marginTop: 20 }}>Initializing node...</Text>
                        <ActivityIndicator size="large" color="#FFF" />
                    </View>
                ) : <View style={globalTheme.ChatTheme.paymentModals.breezInitView}></View>}

                {!startingNode && (
                    <View>
                        <View>


                            <Text style={{ ...globalTheme.TextTheme.label, marginBottom: 10 }}>Select currency:</Text>

                            <SelectList

                                setSelected={(val: Currency) => setCurrencyType(val)}
                                data={Object.values(Currency)}
                                save="value"
                                boxStyles={{ backgroundColor: 'white', marginBottom: 10, borderRadius: 5, height: 45 }}
                                dropdownItemStyles={{ backgroundColor: 'white', borderRadius: 0 }}
                                search={false}
                                defaultOption={{ key: Currency.BITCOIN, value: Currency.BITCOIN }}
                                dropdownStyles={{ backgroundColor: 'white', position: 'absolute', height: 95, top: 35, zIndex: 10, right: 5, left: 5, borderRadius: 5 }}
                            />

                            <Text style={{ ...globalTheme.TextTheme.label, marginTop: 10 }}>Enter amount:</Text>

                            <TextInput
                                style={{ ...globalTheme.Inputs.textInput, margin: 10 }}
                                onChangeText={setCurrencyAmount}
                                value={currencyAmount}
                                placeholder="Amount"
                                keyboardType="numeric"
                            />
                            {currencyType === Currency.BITCOIN ? <Text style={globalTheme.TextTheme.label}>{btcZarPrice && btcZarPrice !== -1 ? ('    (R' + (Number(currencyAmount) / 100000000 * btcZarPrice).toFixed(2) + ')\n') : btcZarPrice === -1 ? ('Fetching price') : "Problem getting BTC price"}</Text>
                                : <Text style={globalTheme.TextTheme.label}>{btcZarPrice && btcZarPrice !== -1 ? ('    (' + ((Number(currencyAmount) / btcZarPrice) * 100000000).toFixed(2) + ' Satoshis)\n') : btcZarPrice === -1 ? ('Fetching price') : "Problem getting BTC price"}</Text>}
                        </View>
                        <TouchableOpacity
                            style={!checkIfBTCPriceWasFetched() ? globalTheme.ChatTheme.paymentModals.mainButton : globalTheme.ChatTheme.paymentModals.disabledMainButton}
                            onPress={() => {
                                console.log('Generate invoice button pressed');
                                handleGetInvoiceButtonPress();
                            }}
                            disabled={checkIfBTCPriceWasFetched()}
                        >
                            {invoiceGenLoading ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <Text style={globalTheme.TextTheme.label}>Generate and Send Invoice</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
                {paymentStatusDesc ? <Text style={{ color: 'white', minHeight: 50 }}>{paymentStatusDesc}</Text> : <Text style={{ minHeight: 50 }}></Text>}

                {/* Close Button at the bottom */}
                <View style={{ width: '100%', alignItems: 'center', marginBottom: 20 }}>
                    <TouchableOpacity
                        style={globalTheme.ChatTheme.paymentModals.closeButton}
                        onPress={() => setShowRequestLightningPaymentModal(false)}
                    >
                        <Text style={{ color: '#fff' }}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

export default RequestPaymentModal;
