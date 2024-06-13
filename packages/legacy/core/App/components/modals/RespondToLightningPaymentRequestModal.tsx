import React from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { theme as globalTheme } from '../../theme';

interface RespondsToPaymentRequestModalProps {
    showRespondToLightningPaymentModal: boolean;
    setShowRespondToLightningPaymentModal: (show: boolean) => void;
    currencyAmount: string;
    btcZarPrice?: number;
    invoiceGenLoading: boolean;
    handleGetInvoiceButtonPress: () => void;
    paymentStatusDesc?: string;
    startingNode?: boolean; // Assuming startingNode might be a prop as well
    breezInitializing: boolean;
}

const RespondToPaymentRequestModal: React.FC<RespondsToPaymentRequestModalProps> = ({
    showRespondToLightningPaymentModal,
    setShowRespondToLightningPaymentModal,
    currencyAmount,
    btcZarPrice,
    invoiceGenLoading,
    handleGetInvoiceButtonPress,
    paymentStatusDesc,
    startingNode,
    breezInitializing,
}) => {

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={showRespondToLightningPaymentModal}
            onRequestClose={() => {
                setShowRespondToLightningPaymentModal(false);
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
                    <View style={{ alignContent: 'center', alignItems: 'center' }}>
                        <View>
                            <Text style={{ ...globalTheme.TextTheme.label, marginTop: 10, padding: 10 }}>This contact would like to send you a payment of {currencyAmount} Satoshis</Text>

                            <Text style={globalTheme.TextTheme.label}>{btcZarPrice && btcZarPrice !== -1 ? ('    (R' + (Number(currencyAmount) / 100000000 * btcZarPrice).toFixed(2) + ')\n') : btcZarPrice === -1 ? ('Fetching price') : "Problem getting BTC price"}</Text>
                        </View>

                        <TouchableOpacity
                            style={globalTheme.ChatTheme.paymentModals.mainButton}
                            onPress={() => {
                                console.log('Generate invoice button pressed');
                                handleGetInvoiceButtonPress();
                            }}
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
                        onPress={() => setShowRespondToLightningPaymentModal(false)}
                    >
                        <Text style={{ color: '#fff' }}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

export default RespondToPaymentRequestModal;
