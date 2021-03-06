import {
  Collection,
  Product,
  SanityClient,
  SyncOperation,
  SanityShopifyDocument
} from '@sane-shopify/types'
import { isMatch } from 'lodash-es'
import { prepareDocument, sleep } from './utils'

export const createSyncSanityDocument = (client: SanityClient) => async (
  item: Product | Collection
): Promise<SyncOperation> => {
  const getSanityDocByShopifyId = async (
    shopifyId: string
  ): Promise<SanityShopifyDocument | void> =>
    client.fetch<SanityShopifyDocument>(
      `*[shopifyId == $shopifyId]{
        products[]->,
        collections[]->,
        ...
      }[0]`,
      {
        shopifyId
      }
    )

  const syncItem = async (
    item: Product | Collection
  ): Promise<SyncOperation> => {
    const docInfo = prepareDocument(item)
    const existingDoc = await getSanityDocByShopifyId(item.id)

    /* If the document exists and is up to date, skip */
    if (existingDoc && isMatch(existingDoc, docInfo)) {
      return {
        type: 'skip' as 'skip',
        sanityDocument: existingDoc,
        shopifySource: item
      }
    }

    /* Rate limit */
    await sleep(201)

    /* Create a new document if none exists */
    if (!existingDoc) {
      const newDoc = await client.create<SanityShopifyDocument>(docInfo)
      return {
        type: 'create' as 'create',
        sanityDocument: newDoc,
        shopifySource: item
      }
    }

    /* Otherwise, update the existing doc */

    const updatedDoc = await client
      .patch<SanityShopifyDocument>(existingDoc._id)
      .set(docInfo)
      .commit()

    return {
      type: 'update' as 'update',
      sanityDocument: updatedDoc,
      shopifySource: item
    }
  }
  return syncItem(item)
}
