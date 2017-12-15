const objectPath = require('object-path')
const aws = require('aws-sdk')
const db = require('../db')
const calcParcelStatus = require('../helper_functions/calcParcelStatus')
const getFillSlotsEventName = require('../helper_functions/getFillSlotsEventName')
const checkShouldSuppress = require('../helper_functions/checkShouldSuppress')

aws.config.update({region: 'eu-central-1'})

const getIcon = (type, status) => {
    const icons = {
        received: `https://s3.eu-central-1.amazonaws.com/digital-logistic-web/01_pacel_received_${status}.png`,
        transport: `https://s3.eu-central-1.amazonaws.com/digital-logistic-web/02_parcel_transport_${status}.png`,
        factory: `https://s3.eu-central-1.amazonaws.com/digital-logistic-web/03_parcel_factroy_${status}.png`,
        delivery: `https://s3.eu-central-1.amazonaws.com/digital-logistic-web/04_parcel_delivery_${status}.png`
    }
    
    return icons[type]
}

module.exports = (req, api) => {
    // SENDER ID: console.log(req.body.originalRequest.data.sender.id)

    const parcelId = objectPath.get(req, 'body.result.parameters.parcel_id.parcel_id')

    let calculateResult = () => {
        return Promise.resolve({})
    }

    if (checkShouldSuppress(req)) {
        calculateResult = () => {
            return db.getParcels(parcelId)
                .then(parcels => {
                    const parcel = parcels[parcelId]

                    if (!parcel) {
                        return { 
                            followupEvent: {
                                data: { 
                                    error_message: 'Es konnte kein Paket gefunden werden', 
                                }, 
                                name: 'fill_slots_display_status_details' 
                            }
                        }
                    }

                    const data = {
                        parcel_id: parcelId,
                        status: 'Unbekannt'
                    }

                    parcel.Status.forEach(status => {
                        data[status.type] = {
                            description: status.description,
                            Status: status.Status,
                            type: status.type,
                            icon_prefix: getIcon(status.type, status.Status)
                        }
                    })

                    const {status} = calcParcelStatus(parcel)

                    data.status = status

                    const result = {
                        followupEvent: {
                            data,
                            name: getFillSlotsEventName(req)
                        }
                    }

                    return result
                })
        }
    }

    return calculateResult()
        .then(result => new api.ApiResponse(result, {'Content-Type': 'application/json'}, 200))
}