export interface SqsCarEvent {
  detail: CarEventDetail
  receiptHandle: string
  messageId: string
}

export interface CarEventDetail {
  key: string
  url: string
}
