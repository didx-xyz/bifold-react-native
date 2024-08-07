import {
  BasicMessageRecord,
  BasicMessageRepository,
  CredentialExchangeRecord,
  CredentialState,
  ProofExchangeRecord,
  ProofState,
} from '@aries-framework/core'
import { useAgent, useBasicMessagesByConnectionId, useConnectionById } from '@aries-framework/react-hooks'
import { PaymentStatus } from '@breeztech/react-native-breez-sdk'
import { isPresentationReceived } from '@hyperledger/aries-bifold-verifier'
import { useIsFocused, useNavigation } from '@react-navigation/core'
import { StackNavigationProp, StackScreenProps } from '@react-navigation/stack'
import { set } from 'mockdate'
import { extract } from 'query-string'
import React, { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking, Text, TouchableOpacity, View } from 'react-native'
import { GiftedChat, IMessage } from 'react-native-gifted-chat'
import { SafeAreaView } from 'react-native-safe-area-context'

import InfoIcon from '../components/buttons/InfoIcon'
import { renderComposer, renderInputToolbar, renderSend } from '../components/chat'
import ActionSlider from '../components/chat/ActionSlider'
import { renderActions } from '../components/chat/ChatActions'
import { ChatEvent } from '../components/chat/ChatEvent'
import { ChatMessage, ExtendedChatMessage, CallbackType } from '../components/chat/ChatMessage'
import CheckLightningTransactionModal from '../components/modals/CheckLightningPaymentModal'
import InitiatePaymentModal from '../components/modals/InitiateLightningPaymentModal'
import PayWithBitcoinLightningModal from '../components/modals/MakeLightningPaymentModal'
import RequestPaymentModal from '../components/modals/RequestLightningPaymentModal'
import RespondToPaymentRequestModal from '../components/modals/RespondToLightningPaymentRequestModal'
import { useNetwork } from '../contexts/network'
import { useStore } from '../contexts/store'
import { useTheme } from '../contexts/theme'
import { useCredentialsByConnectionId } from '../hooks/credentials'
import { useProofsByConnectionId } from '../hooks/proofs'
import { theme as globalTheme } from '../theme'
import { Role } from '../types/chat'
import { BasicMessageMetadata, basicMessageCustomMetadata } from '../types/metadata'
import { RootStackParams, ContactStackParams, Screens, Stacks } from '../types/navigators'
import {
  getConnectionName,
  getCredentialEventLabel,
  getCredentialEventRole,
  getMessageEventRole,
  getProofEventLabel,
  getProofEventRole,
} from '../utils/helpers'
import {
  checkStatus,
  getBTCPrice,
  getInvoice,
  breezInitHandler,
  invoicePaymentHandler,
  checkMnemonic,
  Currency,
  getZarToBTCAmount,
} from '../utils/lightningHelpers'

type ChatProps = StackScreenProps<ContactStackParams, Screens.Chat> | StackScreenProps<RootStackParams, Screens.Chat>

const Chat: React.FC<ChatProps> = ({ route }) => {
  if (!route?.params) {
    throw new Error('Chat route params were not set properly')
  }

  const { connectionId } = route.params
  const [store] = useStore()
  const { t } = useTranslation()
  const { agent } = useAgent()
  const navigation = useNavigation<StackNavigationProp<RootStackParams | ContactStackParams>>()
  const connection = useConnectionById(connectionId)
  const basicMessages = useBasicMessagesByConnectionId(connectionId)
  const credentials = useCredentialsByConnectionId(connectionId)
  const proofs = useProofsByConnectionId(connectionId)
  const isFocused = useIsFocused()
  const { assertConnectedNetwork, silentAssertConnectedNetwork } = useNetwork()
  const [messages, setMessages] = useState<Array<ExtendedChatMessage>>([])
  const [showActionSlider, setShowActionSlider] = useState(false)
  const { ChatTheme: theme, Assets } = useTheme()
  const { ColorPallet } = useTheme()
  const [theirLabel, setTheirLabel] = useState(getConnectionName(connection, store.preferences.alternateContactNames))
  const [showLightningPayModal, setShowLightningPayModal] = useState(false)
  const [showRequestLightningPaymentModal, setShowRequestLightningPaymentModal] = useState(false)
  const [showTransactionStatusModal, setShowTransactionStatusModal] = useState(false)
  const [showInitiateLightningPaymentModal, setShowInitiateLightningPaymentModal] = useState(false)
  const [showRespondToLightningPaymentModal, setShowRespondToLightningPaymentModal] = useState(false)
  const [invoiceText, setInvoiceText] = useState<string | undefined>(undefined)
  const [invoiceHash, setInvoiceHash] = useState<string | undefined>(undefined)
  const [generatedInvoice, setGeneratedInvoice] = useState<string | undefined>(undefined)
  const [invoiceGenLoading, setInvoiceGenLoading] = useState(false)
  const [paymentInProgress, setPaymentInProgress] = useState(false)
  const [paymentCheckInProgress, setPaymentCheckInProgress] = useState(false)
  const [currencyAmount, setCurrencyAmount] = useState('2550')
  const [paymentStatusDesc, setPaymentStatusDesc] = useState<string | undefined>(undefined)
  const [checkStatusDesc, setCheckStatusDesc] = useState<string | undefined>(undefined)
  const [btcZarPrice, setBtcZarPrice] = useState<number | undefined>(-1)
  const [currencyType, setCurrencyType] = useState<Currency>(Currency.BITCOIN)
  const [nodeAndSdkInitializing, setNodeAndSdkInitializing] = React.useState(false)

  enum BasicMessageTypeIdentifiers {
    LightningInvoice = '01-type-lnbc',
    LightningRequest = '02-type-request-to-pay',
  }

  // This useEffect is for properly rendering changes to the alt contact name, useMemo did not pick them up
  useEffect(() => {
    setTheirLabel(getConnectionName(connection, store.preferences.alternateContactNames))
  }, [isFocused, connection, store.preferences.alternateContactNames])

  useMemo(() => {
    assertConnectedNetwork()
  }, [])

  useEffect(() => {
    navigation.setOptions({
      title: theirLabel,
      headerRight: () => <InfoIcon connectionId={connection?.id as string} />,
    })
  }, [connection, theirLabel])

  // when chat is open, mark messages as seen
  useEffect(() => {
    basicMessages.forEach((msg) => {
      const meta = msg.metadata.get(BasicMessageMetadata.customMetadata) as basicMessageCustomMetadata
      if (agent && !meta?.seen) {
        msg.metadata.set(BasicMessageMetadata.customMetadata, { ...meta, seen: true })
        const basicMessageRepository = agent.context.dependencyManager.resolve(BasicMessageRepository)
        basicMessageRepository.update(agent.context, msg)
      }
    })
  }, [basicMessages])

  const eventHandler = (breezEvent: any) => {
    console.log('event', JSON.stringify(breezEvent))
  }

  useEffect(() => {
    const callbackTypeForMessage = (record: CredentialExchangeRecord | ProofExchangeRecord | BasicMessageRecord) => {
      console.log('record', record)
      if (record instanceof CredentialExchangeRecord || record instanceof ProofExchangeRecord) {
        if (
          record instanceof CredentialExchangeRecord &&
          (record.state === CredentialState.Done || record.state === CredentialState.OfferReceived)
        ) {
          return CallbackType.CredentialOffer
        }

        if (
          (record instanceof ProofExchangeRecord &&
            isPresentationReceived(record) &&
            record.isVerified !== undefined) ||
          record.state === ProofState.RequestReceived ||
          (record.state === ProofState.Done && record.isVerified === undefined)
        ) {
          return CallbackType.ProofRequest
        }

        if (
          record instanceof ProofExchangeRecord &&
          (record.state === ProofState.PresentationSent || record.state === ProofState.Done)
        ) {
          return CallbackType.PresentationSent
        }
      } else if (record instanceof BasicMessageRecord) {
        if (record.content.includes(BasicMessageTypeIdentifiers.LightningInvoice)) {
          console.log('Lightning invoice detected!!!')
          return CallbackType.LightningPaymentInvoice
        } else if (record.content.includes(BasicMessageTypeIdentifiers.LightningRequest)) {
          return CallbackType.LightningRequestToPay
        }
      }
    }

    const extractLightningInvoiceMessage = (inputString: string) => {
      try {
        const bolt11 = inputString.split(',')
        if (bolt11.length === 3) {
          const match = bolt11[1].match(/lnbc[a-zA-Z0-9]+/)
          return match ? match[0] : null
        } else {
          return null
        }
      } catch (err: any) {
        console.error('Error extracting lightning invoice from message')
        console.error(err)
        return null
      }
    }

    const extractHashFromInvoiceMessage = (inputString: string) => {
      try {
        const hash = inputString.split(',')[2]
        return hash
      } catch (err: any) {
        console.error('Error extracting hash from invoice message')
        console.error(err)
        return null
      }
    }

    const transformedMessages: Array<ExtendedChatMessage> = basicMessages.map((record: BasicMessageRecord) => {
      const role = getMessageEventRole(record)
      // eslint-disable-next-line
      const linkRegex = /(?:https?\:\/\/\w+(?:\.\w+)+\S*)|(?:[\w\d\.\_\-]+@\w+(?:\.\w+)+)/gm
      // eslint-disable-next-line
      const mailRegex = /^[\w\d\.\_\-]+@\w+(?:\.\w+)+$/gm
      const links = record.content.match(linkRegex) ?? []
      const callbackType = callbackTypeForMessage(record)

      const handleLightningPayPress = (content: string) => {
        setPaymentStatusDesc(undefined)
        setShowLightningPayModal(true)

        try {
          getBTCPrice().then((response) => {
            setBtcZarPrice(response)
          })
        } catch (err: any) {
          console.error(err)
        }

        console.log('Lightning invoice pressed', content)
        const invoice = extractLightningInvoiceMessage(content)
        console.log('Invoice:', invoice)
        if (invoice !== null) {
          setInvoiceText(invoice)
        } else {
          setInvoiceText(undefined)
        }
      }

      const handleCheckStatusPress = (content: string) => {
        setShowTransactionStatusModal(true)
        const hash = extractHashFromInvoiceMessage(content)
        const invoice = extractLightningInvoiceMessage(content)

        try {
          getBTCPrice().then((response) => {
            setBtcZarPrice(response)
          })
        } catch (err: any) {
          console.error(err)
        }

        console.log('Raw Content:', content)
        if (invoice !== null) {
          setInvoiceText(invoice)
        }
        setCheckStatusDesc(undefined)
        if (hash !== null) {
          setInvoiceHash(hash)
        } else {
          setInvoiceHash(undefined)
        }
      }

      const handleAcceptLightningPayment = (content: string) => {
        try {
          const amount = Number(content.split(',')[1])
          // handleGetInvoiceButtonPress(amount)
          setCurrencyAmount(amount.toString())
          getBTCPrice().then((response) => {
            setBtcZarPrice(response)
          })
          setShowRespondToLightningPaymentModal(true)
        } catch (err: any) {
          console.error(err)
        }
      }
      const handleLinkPress = (link: string) => {
        if (link.match(mailRegex)) {
          link = 'mailto:' + link
        }
        Linking.openURL(link)
      }
      const msgText = (
        <Text style={role === Role.me ? theme.rightText : theme.leftText}>
          {record.content.split(linkRegex).map((split, i) => {
            if (callbackType === CallbackType.LightningPaymentInvoice) {
              if (role === Role.them) {
                return (
                  <View>
                    <Text style={{ color: 'white' }}>⚡ Lightning Invoice Received</Text>
                    <Text
                      onPress={() => handleLightningPayPress(record.content)}
                      style={{ color: ColorPallet.brand.link, textDecorationLine: 'underline' }}
                      accessibilityRole={'link'}
                    >
                      {'\n'}
                      Pay Invoice
                    </Text>
                  </View>
                )
              } else {
                return (
                  <View>
                    <Text style={{ color: 'white' }}>⚡ Lightning Invoice Sent</Text>
                    <Text
                      onPress={() => handleCheckStatusPress(record.content)}
                      style={{ color: ColorPallet.brand.link, textDecorationLine: 'underline' }}
                      accessibilityRole={'link'}
                    >
                      {'\n'}
                      Check Status
                    </Text>
                  </View>
                )
              }
            } else if (callbackType === CallbackType.LightningRequestToPay) {
              if (role === Role.them) {
                return (
                  <View>
                    <Text style={{ color: 'white' }}>⚡ Incoming Lightning Payment</Text>
                    <Text
                      onPress={() => handleAcceptLightningPayment(record.content)}
                      style={{ color: ColorPallet.brand.link, textDecorationLine: 'underline' }}
                      accessibilityRole={'link'}
                    >
                      {'\n'}
                      Send Invoice to Receive Payment
                    </Text>
                  </View>
                )
              } else {
                return (
                  <View style={{ flexWrap: 'wrap', width: '100%' }}>
                    <Text style={{ color: 'white' }}>⚡ Request to Pay Sent</Text>
                    <Text style={{ color: 'white' }}>
                      {'\n'}
                      Please Wait for Invoice from {'\n'}
                      {theirLabel}
                    </Text>
                  </View>
                )
              }
            } else if (i < links.length) {
              const link = links[i]
              return (
                <Fragment key={`${record.id}-${i}`}>
                  <Text>{split}</Text>
                  <Text
                    onPress={() => handleLinkPress(link)}
                    style={{ color: ColorPallet.brand.link, textDecorationLine: 'underline' }}
                    accessibilityRole={'link'}
                  >
                    {link}
                  </Text>
                </Fragment>
              )
            }
            return <Text key={`${record.id}-${i}`}>{split}</Text>
          })}
        </Text>
      )
      return {
        _id: record.id,
        text: record.content,
        renderEvent: () => msgText,
        createdAt: record.updatedAt || record.createdAt,
        type: record.type,
        user: { _id: role },
      }
    })

    transformedMessages.push(
      ...credentials.map((record: CredentialExchangeRecord) => {
        const role = getCredentialEventRole(record)
        const userLabel = role === Role.me ? t('Chat.UserYou') : theirLabel
        const actionLabel = t(getCredentialEventLabel(record) as any)

        return {
          _id: record.id,
          text: actionLabel,
          renderEvent: () => <ChatEvent role={role} userLabel={userLabel} actionLabel={actionLabel} />,
          createdAt: record.updatedAt || record.createdAt,
          type: record.type,
          user: { _id: role },
          messageOpensCallbackType: callbackTypeForMessage(record),
          onDetails: () => {
            const navMap: { [key in CredentialState]?: () => void } = {
              [CredentialState.Done]: () => {
                navigation.navigate(Stacks.ContactStack as any, {
                  screen: Screens.CredentialDetails,
                  params: { credential: record },
                })
              },
              [CredentialState.OfferReceived]: () => {
                navigation.navigate(Stacks.ContactStack as any, {
                  screen: Screens.CredentialOffer,
                  params: { credentialId: record.id },
                })
              },
            }
            const nav = navMap[record.state]
            if (nav) {
              nav()
            }
          },
        }
      })
    )

    transformedMessages.push(
      ...proofs.map((record: ProofExchangeRecord) => {
        const role = getProofEventRole(record)
        const userLabel = role === Role.me ? t('Chat.UserYou') : theirLabel
        const actionLabel = t(getProofEventLabel(record) as any)

        return {
          _id: record.id,
          text: actionLabel,
          renderEvent: () => <ChatEvent role={role} userLabel={userLabel} actionLabel={actionLabel} />,
          createdAt: record.updatedAt || record.createdAt,
          type: record.type,
          user: { _id: role },
          messageOpensCallbackType: callbackTypeForMessage(record), //TODO: Add LightningPaymentInvoice callback type
          onDetails: () => {
            const toProofDetails = () => {
              navigation.navigate(Stacks.ContactStack as any, {
                screen: Screens.ProofDetails,
                params: {
                  recordId: record.id,
                  isHistory: true,
                  senderReview:
                    record.state === ProofState.PresentationSent ||
                    (record.state === ProofState.Done && record.isVerified === undefined),
                },
              })
            }
            const navMap: { [key in ProofState]?: () => void } = {
              [ProofState.Done]: toProofDetails,
              [ProofState.PresentationSent]: toProofDetails,
              [ProofState.PresentationReceived]: toProofDetails,
              [ProofState.RequestReceived]: () => {
                navigation.navigate(Stacks.ContactStack as any, {
                  screen: Screens.ProofRequest,
                  params: { proofId: record.id },
                })
              },
            }
            const nav = navMap[record.state]
            if (nav) {
              nav()
            }
          },
        }
      })
    )

    const connectedMessage = connection
      ? {
          _id: 'connected',
          text: `${t('Chat.YouConnected')} ${theirLabel}`,
          renderEvent: () => (
            <Text style={theme.rightText}>
              {t('Chat.YouConnected')}
              <Text style={[theme.rightText, theme.rightTextHighlighted]}> {theirLabel}</Text>
            </Text>
          ),
          createdAt: connection.createdAt,
          user: { _id: Role.me },
        }
      : undefined

    setMessages(
      connectedMessage
        ? [...transformedMessages.sort((a: any, b: any) => b.createdAt - a.createdAt), connectedMessage]
        : transformedMessages.sort((a: any, b: any) => b.createdAt - a.createdAt)
    )
  }, [basicMessages, credentials, proofs, theirLabel])

  const onSend = useCallback(
    async (messages: IMessage[]) => {
      await agent?.basicMessages.sendMessage(connectionId, messages[0].text)
    },
    [agent, connectionId]
  )

  const onSendRequest = useCallback(async () => {
    navigation.navigate(Stacks.ProofRequestsStack as any, {
      screen: Screens.ProofRequests,
      params: { navigation: navigation, connectionId },
    })
  }, [navigation, connectionId])

  const actions = useMemo(() => {
    return store.preferences.useVerifierCapability
      ? [
          {
            text: t('Verifier.SendProofRequest'),
            onPress: () => {
              setShowActionSlider(false)
              onSendRequest()
            },
            icon: () => <Assets.svg.iconInfoSentDark height={30} width={30} />,
          },
        ]
      : undefined
  }, [t, store.preferences.useVerifierCapability, onSendRequest])

  const onDismiss = () => {
    setShowActionSlider(false)
  }

  const payInvoiceButtonHandler = async (invoice: string | undefined) => {
    console.log('Pay invoice handler called')
    let paymentStatus
    try {
      if ((await checkMnemonic()) == false) {
        console.error('Mnemonic not found')
        setPaymentStatusDesc('Create or restore Lightning wallet first')
        return
      }
      setPaymentInProgress(true)
      setNodeAndSdkInitializing(true)
      const initRes = await breezInitHandler(eventHandler)
      setNodeAndSdkInitializing(false)
      if (typeof initRes === 'string') {
        console.error('Error initializing node and sdk')
        setPaymentStatusDesc('Error connecting to lightning node')
        setInvoiceGenLoading(false)
        return
      }

      paymentStatus = await invoicePaymentHandler(invoice)
      setPaymentInProgress(false)

      if (paymentStatus.payment.status === PaymentStatus.COMPLETE) {
        console.log('Payment succeeded')
        setPaymentStatusDesc('Payment Successful')
      } else if (paymentStatus.payment.status === PaymentStatus.FAILED) {
        console.log('Payment failed')
        setPaymentStatusDesc('Payment Failed')
      } else if (paymentStatus.payment.status === PaymentStatus.PENDING) {
        console.log('Payment pending')
        setPaymentStatusDesc('Payment Pending')
      } else {
        console.log(paymentStatus)

        setPaymentStatusDesc(JSON.stringify(paymentStatus).replace(/^"|"$/g, ''))
      }
    } catch (err: any) {
      console.error(err)

      setPaymentStatusDesc(JSON.stringify(paymentStatus).replace(/^"|"$/g, ''))
    }
  }

  const checkStatusHandler = async () => {
    console.log('Check status handler called')
    let paymentStatus
    console.log('Hash:', invoiceHash)

    if ((await checkMnemonic()) == false) {
      console.error('Mnemonic not found')
      setPaymentStatusDesc('Create or restore Lightning wallet first')
      return
    }

    try {
      if (invoiceHash) {
        setNodeAndSdkInitializing(true)
        const initRes = await breezInitHandler(eventHandler)
        setNodeAndSdkInitializing(false)
        if (typeof initRes === 'string') {
          console.error('Error initializing node and sdk')
          setCheckStatusDesc('Error connecting to lightning node')
          setInvoiceGenLoading(false)
          return
        }

        setPaymentCheckInProgress(true)
        paymentStatus = await checkStatus(invoiceHash)
        setPaymentCheckInProgress(false)

        setCheckStatusDesc(paymentStatus)
      }
    } catch (err: any) {
      console.error(err)

      setCheckStatusDesc(JSON.stringify(paymentStatus))
    }
  }

  const handleGetInvoiceButtonPress = async (amount: number | undefined = undefined) => {
    if ((await checkMnemonic()) == false) {
      console.error('Mnemonic not found')
      setPaymentStatusDesc('Create or restore Lightning wallet first')
      return
    }

    setInvoiceGenLoading(true)
    setNodeAndSdkInitializing(true)
    const initRes = await breezInitHandler(eventHandler)
    setNodeAndSdkInitializing(false)
    if (typeof initRes === 'string') {
      console.error('Error String: ', initRes)
      setPaymentStatusDesc('Error connecting to lightning node')
      setInvoiceGenLoading(false)
      return
    }

    let tmpAmount
    if (amount) {
      tmpAmount = amount
    } else if (currencyType === Currency.ZAR) {
      tmpAmount = await getZarToBTCAmount(Number(currencyAmount))
    } else {
      tmpAmount = Number(currencyAmount)
    }
    const tmpInvoice = await getInvoice(String(tmpAmount))
    setInvoiceGenLoading(false)
    if (typeof tmpInvoice !== 'string' && tmpInvoice?.amountMsat !== undefined) {
      if (tmpInvoice?.amountMsat) {
        setGeneratedInvoice(tmpInvoice.amountMsat.toString())
        agent?.basicMessages.sendMessage(
          connectionId,
          BasicMessageTypeIdentifiers.LightningInvoice + ',' + tmpInvoice.bolt11 + ',' + tmpInvoice.paymentHash
        )
        setShowRequestLightningPaymentModal(false)
        setShowRespondToLightningPaymentModal(false)
      } else {
        setPaymentStatusDesc('Error generating invoice')
      }
    }
  }

  const handleInitiatePayment = async () => {
    try {
      let tmpSatsAmount
      if (currencyType === Currency.ZAR) {
        tmpSatsAmount = getZarToBTCAmount(Number(currencyAmount))
      } else {
        tmpSatsAmount = Number(currencyAmount)
      }
      agent?.basicMessages.sendMessage(connectionId, BasicMessageTypeIdentifiers.LightningRequest + ',' + tmpSatsAmount)
      setShowInitiateLightningPaymentModal(false)
    } catch (err: any) {
      console.error(err)
    }
  }
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, paddingTop: 0 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', backgroundColor: 'white' }}>
        <TouchableOpacity
          style={globalTheme.Buttons.lightningInvoice}
          onPress={() => {
            setShowInitiateLightningPaymentModal(true)
            setPaymentStatusDesc(undefined)
            try {
              getBTCPrice().then((response) => {
                setBtcZarPrice(response)
              })
            } catch (err: any) {
              console.error(err)
            }
          }}
        >
          <Text style={{ ...globalTheme.TextTheme.label, color: 'black' }}>⚡ Make Payment</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={globalTheme.Buttons.lightningInvoice}
          onPress={() => {
            setShowRequestLightningPaymentModal(true)
            setPaymentStatusDesc(undefined)
            try {
              getBTCPrice().then((response) => {
                setBtcZarPrice(response)
              })
            } catch (err: any) {
              console.error(err)
            }
          }}
        >
          <Text style={{ ...globalTheme.TextTheme.label, color: 'black' }}>⚡ Request Payment</Text>
        </TouchableOpacity>

        {invoiceGenLoading ? <Text style={{ ...globalTheme.TextTheme.label, color: 'black' }}>LOADING</Text> : null}
      </View>

      <GiftedChat
        messages={messages}
        showAvatarForEveryMessage={true}
        alignTop
        renderAvatar={() => null}
        messageIdGenerator={(msg) => msg?._id.toString() || '0'}
        renderMessage={(props) => <ChatMessage messageProps={props} />}
        renderInputToolbar={(props) => renderInputToolbar(props, theme)}
        renderSend={(props) => renderSend(props, theme)}
        renderComposer={(props) => renderComposer(props, theme, t('Contacts.TypeHere'))}
        disableComposer={!silentAssertConnectedNetwork()}
        onSend={onSend}
        user={{
          _id: Role.me,
        }}
        renderActions={(props) => renderActions(props, theme, actions)}
        onPressActionButton={actions ? () => setShowActionSlider(true) : undefined}
      />

      {showActionSlider && <ActionSlider onDismiss={onDismiss} actions={actions} />}

      <RequestPaymentModal
        showRequestLightningPaymentModal={showRequestLightningPaymentModal}
        setShowRequestLightningPaymentModal={setShowRequestLightningPaymentModal}
        setCurrencyAmount={setCurrencyAmount}
        currencyAmount={currencyAmount}
        setCurrencyType={setCurrencyType}
        currencyType={currencyType}
        btcZarPrice={btcZarPrice}
        invoiceGenLoading={invoiceGenLoading}
        handleGetInvoiceButtonPress={handleGetInvoiceButtonPress}
        paymentStatusDesc={paymentStatusDesc}
        breezInitializing={nodeAndSdkInitializing}
        eventHandler={eventHandler}
      />

      <PayWithBitcoinLightningModal
        showLightningPayModal={showLightningPayModal}
        setShowLightningPayModal={setShowLightningPayModal}
        invoiceText={invoiceText}
        btcZarPrice={btcZarPrice}
        paymentInProgress={paymentInProgress}
        payInvoiceHandler={payInvoiceButtonHandler}
        paymentStatusDesc={paymentStatusDesc}
        breezInitializing={nodeAndSdkInitializing}
        eventHandler={eventHandler}
      />

      <CheckLightningTransactionModal
        showTransactionStatusModal={showTransactionStatusModal}
        setShowTransactionStatusModal={setShowTransactionStatusModal}
        invoiceText={invoiceText}
        btcZarPrice={btcZarPrice}
        paymentInProgress={paymentCheckInProgress}
        statusCheckHandler={checkStatusHandler}
        checkStatusDesc={checkStatusDesc}
        breezInitializing={nodeAndSdkInitializing}
        eventHandler={eventHandler}
      />

      <InitiatePaymentModal
        showInitiateLightningPaymentModal={showInitiateLightningPaymentModal}
        setShowInitiateLightningPaymentModal={setShowInitiateLightningPaymentModal}
        setCurrencyAmount={setCurrencyAmount}
        currencyAmount={currencyAmount}
        setCurrencyType={setCurrencyType}
        currencyType={currencyType}
        btcZarPrice={btcZarPrice}
        sendPaymentInitiateMessage={handleInitiatePayment}
      />

      <RespondToPaymentRequestModal
        showRespondToLightningPaymentModal={showRespondToLightningPaymentModal}
        setShowRespondToLightningPaymentModal={setShowRespondToLightningPaymentModal}
        currencyAmount={currencyAmount}
        btcZarPrice={btcZarPrice}
        handleGetInvoiceButtonPress={handleGetInvoiceButtonPress}
        invoiceGenLoading={invoiceGenLoading}
        breezInitializing={nodeAndSdkInitializing}
        theirLabel={theirLabel}
      />
    </SafeAreaView>
  )
}

export default Chat
