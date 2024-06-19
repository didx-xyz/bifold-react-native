import { ConnectionRecord, DidExchangeRole, DidExchangeState } from '@aries-framework/core'
import { useConnections } from '@aries-framework/react-hooks'
import { useNavigation } from '@react-navigation/core'
import { act, fireEvent, render } from '@testing-library/react-native'
import React from 'react'

import { ConfigurationContext } from '../../App/contexts/configuration'
import { StoreProvider, defaultState } from '../../App/contexts/store'
import ListContacts from '../../App/screens/ListContacts'
import configurationContext from '../contexts/configuration'

jest.mock('@react-navigation/core', () => {
  return require('../../__mocks__/custom/@react-navigation/core')
})
jest.mock('@react-navigation/native', () => {
  return require('../../__mocks__/custom/@react-navigation/native')
})
// eslint-disable-next-line @typescript-eslint/no-empty-function
jest.mock('react-native-localize', () => {})

const navigation = useNavigation()

describe('ListContacts Component', () => {
  const testContactRecord1 = new ConnectionRecord({
    id: '1',
    did: '9gtPKWtaUKxJir5YG2VPxX',
    theirLabel: 'Faber',
    role: DidExchangeRole.Responder,
    theirDid: '2SBuq9fpLT8qUiQKr2RgBe',
    threadId: '1',
    state: DidExchangeState.Completed,
    createdAt: new Date('2020-01-01T00:00:00.000Z'),
  })
  const testContactRecord2 = new ConnectionRecord({
    id: '2',
    did: '2SBuq9fpLT8qUiQKr2RgBe',
    role: DidExchangeRole.Requester,
    theirLabel: 'Bob',
    theirDid: '9gtPKWtaUKxJir5YG2VPxX',
    threadId: '1',
    state: DidExchangeState.Completed,
    createdAt: new Date('2020-01-01T00:00:00.000Z'),
  })

  beforeEach(() => {
    jest.clearAllMocks()

    // @ts-ignore
    useConnections.mockReturnValue({ records: [testContactRecord1, testContactRecord2] })
  })

  const renderView = () => {
    return render(
      <ConfigurationContext.Provider value={configurationContext}>
       
      </ConfigurationContext.Provider>
    )
  }
})
