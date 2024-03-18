import { getItem, setItem } from "./storage";

const smartproxyUrl = 'https://7660-197-255-153-28.ngrok-free.app'

interface OwnerResponse {
    createdAt: string;
    details: string;
    externalIdentifier: string;
    id: string;
    identifier: string;
    updatedAt: string;
}

export const registerOnSmartProxy = async (identifier: string, externalIdentifier: string, details: string) => {
    try {
        const storedData = await getItem('proxyOwner');
        console.log(storedData);

        if (storedData) {
            console.log('Already Registered: ' + storedData.id);
            return;
        }

        const response = await fetch(smartproxyUrl + '/owners', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                identifier,
                externalIdentifier,
                details,
            }),
        });

        console.log("HTTP Response Code:", response.status); // Log the HTTP status code

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        console.log("DATA: " + data);
        await setItem('proxyOwner', data);

    } catch (error) {
        console.error('Error Registering on proxy:', error);
    }
};

export const deRegisterOnSmartProxy = async (identifier: string) => {
    try {

        const response = await fetch(smartproxyUrl + '/owners/identifier/' + identifier, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        console.log("HTTP Response Code:", response.status); // Log the HTTP status code

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

    } catch (error) {
        console.error('Error Deregistering on proxy:', error);
    }
};

export const deleteSmartProxyEntry = async (id: string) => {
    try {

        const response = await fetch(smartproxyUrl + '/proxies/' + id, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        console.log("HTTP Response Code:", response.status); // Log the HTTP status code

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

    } catch (error) {
        console.error('Error Deleting proxy entry:', error);
    }
};

export const createSmartProxyEntry = async (proxyKey: string, details: string, ownerId: string, proxyKeyTypeId: number = 2, proxyTypeId: number = 1) => {
    try {
        const response = await fetch(smartproxyUrl + '/proxies', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                proxyKey,
                proxyKeyTypeId,
                proxyTypeId,
                details,
                ownerId
            }),
        });

        console.log("HTTP Response Code:", response.status); // Log the HTTP status code

        if (!response.ok) {
            console.error(response)
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        console.log(data);

    } catch (error) {
        console.error('Error Creating proxy entry:', error);
    }
};

// Fetch a list of proxies via the 'proxies' endpoint
export const getProxies = async (did: string) => {
    try {
        const response = await fetch(smartproxyUrl + '/proxies');
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        console.log(data);
        return data;
    } catch (error) {
        console.error('Error fetching proxies:', error);
    }
};