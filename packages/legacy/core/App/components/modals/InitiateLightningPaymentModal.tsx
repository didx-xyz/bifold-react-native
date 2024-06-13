// RequestPaymentModal.tsx
import React from 'react';
import { SelectList } from 'react-native-dropdown-select-list'
import { Modal, View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Currency } from '../../utils/lightningHelpers';
import { theme as globalTheme } from '../../theme';

interface InitiatePaymentModalProps {
    showInitiateLightningPaymentModal: boolean;
    setShowInitiateLightningPaymentModal: (show: boolean) => void;
    currencyAmount: string;
    setCurrencyAmount: (amount: string) => void;
    btcZarPrice?: number;
    currencyType: Currency;
    setCurrencyType: (type: Currency) => void;
    sendPaymentInitiateMessage: any;
}

const InitiatePaymentModal: React.FC<InitiatePaymentModalProps> = ({
    showInitiateLightningPaymentModal,
    setShowInitiateLightningPaymentModal,
    currencyAmount,
    btcZarPrice,
    setCurrencyAmount,
    currencyType,
    setCurrencyType,
    sendPaymentInitiateMessage,
}) => {

    const checkIfBTCPriceWasFetched = () => {
        return btcZarPrice === undefined && currencyType === Currency.ZAR || btcZarPrice === -1 && currencyType === Currency.ZAR
    }

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={showInitiateLightningPaymentModal}
            onRequestClose={() => {
                setShowInitiateLightningPaymentModal(false);
            }}
        >
            <View style={globalTheme.ChatTheme.paymentModals.modalView}>
                <Text style={{ ...globalTheme.TextTheme.headerTitle, marginTop: 20 }}>Make Payment</Text>

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
                            console.log('Make payment button pressed');
                            sendPaymentInitiateMessage();
                        }}
                        disabled={checkIfBTCPriceWasFetched()}
                    >

                        <Text style={globalTheme.TextTheme.label}>Request to Make Payment</Text>

                    </TouchableOpacity>
                </View>

                {/* Close Button at the bottom */}
                <View style={{ width: '100%', alignItems: 'center', marginBottom: 20 }}>
                    <TouchableOpacity
                        style={globalTheme.ChatTheme.paymentModals.closeButton}
                        onPress={() => setShowInitiateLightningPaymentModal(false)}
                    >
                        <Text style={{ color: '#fff' }}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

export default InitiatePaymentModal;
