import fs from 'fs';
import path from 'path';

const localesDir = 'c:/Users/ADMIN/OneDrive/Desktop/Projects/Florist/src/i18n/locales';

const translations = {
  es: {
    // ui
    "ui.continueShopping": "Continuar Comprando",
    "ui.custom": "Personalizado",
    "ui.subtotal": "Subtotal",
    "ui.proceedToCheckout": "Proceder al Pago",
    
    // cart
    "cart.browseShop": "Explorar Tienda",
    "cart.continueShopping": "Continuar Comprando",
    "cart.each": "c/u",
    "cart.remove": "Eliminar",
    "cart.subtotal": "Subtotal",
    "cart.standardDeliveryEst": "Envío Estándar (Est.)",
    "cart.salesTaxEst": "Impuesto sobre Ventas (Est.)",
    "cart.checkoutNotice": "❀ Mensaje de tarjeta gratuito y embalaje exclusivo incluidos al finalizar la compra.",
    "cart.proceedToGuestCheckout": "Proceder como Invitado",
    "cart.proceedToCheckout": "Proceder al Pago",
    
    // checkout
    "checkout.youNeedToAddItemsToYourCartBeforeProceedingToCheckout": "Debe agregar artículos a su carrito antes de proceder al pago.",
    "checkout.returnToShop": "Volver a la Tienda",
    "checkout.whoIsThisFor": "¿Para quién es esto?",
    "checkout.deliveryAddress": "Dirección de Entrega",
    "checkout.selectState": "Seleccionar Estado",
    "checkout.continueToDelivery": "Continuar a Entrega",
    "checkout.deliveryOptions": "Opciones de Entrega",
    "checkout.arrivesOnYourSelectedDate": "Llega en la fecha seleccionada",
    "checkout.collectFromOurDowntownStudio": "Recoger en nuestro estudio del centro",
    "checkout.requestedDeliveryDate": "Fecha de Entrega Solicitada",
    "checkout.continueToDetails": "Continuar a Detalles",
    "checkout.yourDetailsGiftMessage": "Sus Datos y Mensaje de Regalo",
    "checkout.yourFullName": "Su Nombre Completo",
    "checkout.standardDeliveryPrice": "Entrega Estándar ($9.99)",
    "checkout.sameDayDeliveryPrice": "Entrega el Mismo Día ($19.99)",
    "checkout.deliveredTodayLimit": "Entregado hoy antes de las 6 PM",
    "checkout.inStorePickupFree": "Recogida en Tienda (Gratis)",
    "checkout.back": "Volver",
    "checkout.emailForReceipt": "Su Correo Electrónico (para el recibo)",
    "checkout.cardMessageOptional": "Mensaje de Tarjeta (Opcional)",
    "checkout.cardMessagePlaceholder": "Escriba una dedicatoria sincera...",
    "checkout.payment": "Pago",
    "checkout.cvc": "CVC",
    "checkout.cvcPlaceholder": "123",
    "checkout.payAmount": "Pagar {amount}",
    "checkout.subtotal": "Subtotal",
    "checkout.delivery": "Entrega",
    "checkout.taxesEstimated": "Impuestos (Estimados)",
    "checkout.total": "Total",
    "checkout.qty": "Cant.",
    "checkout.cardNumber": "Número de Tarjeta",
    "checkout.expiryDate": "Fecha de Vencimiento",
    "checkout.orderSummary": "Resumen del Pedido",
    "checkout.secureCheckout": "Pago Seguro",
    "checkout.stepRecipient": "1. Destinatario",
    "checkout.stepDelivery": "2. Entrega",
    "checkout.stepDetails": "3. Detalles",
    "checkout.stepPayment": "4. Pago",
    "checkout.recipientFullName": "Nombre Completo del Destinatario",
    "checkout.recipientPhone": "Teléfono del Destinatario",
    "checkout.city": "Ciudad",
    "checkout.zipCode": "Código Postal",
    "checkout.continueToPayment": "Continuar al Pago",
    "checkout.cardMessagePlaceholder": "Escriba una dedicatoria sincera...",

    // custombouquet
    "custombouquet.artisanDesc": "Trabaje con nuestros artesanos para crear un arreglo único.",
    "custombouquet.stepOccasion": "Ocasión",
    "custombouquet.stepPalette": "Paleta de Colores",
    "custombouquet.stepFlowers": "Preferencias de Flores",
    "custombouquet.stepSize": "Tamaño y Presupuesto",
    "custombouquet.stepDate": "Fecha de Entrega",
    "custombouquet.stepMessage": "Mensaje de Regalo",
    "custombouquet.stepReview": "Revisión",
    "custombouquet.whatsOccasion": "¿Cuál es la ocasión?",
    "custombouquet.birthday": "Cumpleaños",
    "custombouquet.anniversary": "Aniversario",
    "custombouquet.sympathy": "Condolencias",
    "custombouquet.wedding": "Boda",
    "custombouquet.romance": "Romance",
    "custombouquet.justBecause": "Porque Sí",
    "custombouquet.softBlush": "Rubor Suave y Crema",
    "custombouquet.classicWhites": "Blancos y Verdes Clásicos",
    "custombouquet.warmChampagne": "Champán Cálido y Melocotón",
    "custombouquet.deepReds": "Rojos de Romance Profundo",
    "custombouquet.vibrantColor": "Vibrant y Colorido",
    "custombouquet.floristChoice": "Elección del Florista",
    "custombouquet.roses": "Rosas",
    "custombouquet.peonies": "Peonías",
    "custombouquet.lilies": "Lirios",
    "custombouquet.orchids": "Orquídeas",
    "custombouquet.hydrangeas": "Hortensias",
    "custombouquet.tulips": "Tulipanes",
    "custombouquet.ranunculus": "Ranúnculos",
    "custombouquet.eucalyptus": "Eucalipto",
    "custombouquet.sizeStandardDesc": "Un arreglo hermoso y modesto, perfecto para un escritorio o mesa auxiliar.",
    "custombouquet.sizeDeluxeDesc": "Un arreglo más completo con flores premium. Nuestra opción más popular.",
    "custombouquet.sizePremiumDesc": "Un arreglo espectacular y lujoso con nuestras mejores flores de temporada.",
    "custombouquet.addGiftMessageOptional": "Agregar un mensaje de regalo (Opcional)",
    "custombouquet.writeHeartfeltMessagePlaceholder": "Escriba su mensaje sincero aquí...",
    "custombouquet.occasionLabel": "Ocasión:",
    "custombouquet.paletteLabel": "Paleta de Colores:",
    "custombouquet.flowersLabel": "Flores:",
    "custombouquet.sizeLabel": "Tamaño:",
    "custombouquet.deliveryDateLabel": "Fecha de Entrega:",
    "custombouquet.messageLabel": "Mensaje:",
    "custombouquet.back": "Volver",
    "custombouquet.nextStep": "Siguiente Paso",
    "custombouquet.addToCartWithPrice": "Agregar al Carrito - {price}",

    // occasions
    "occasions.subtitle": "Encuentre el arreglo perfecto para cada momento especial.",
    "occasions.shopOccasion": "Comprar {name}",

    // orderconfirmation
    "orderconfirmation.returnToStorefront": "Volver a la Tienda",
    "orderconfirmation.goToTrackOrder": "Ir a Rastrear Pedido",
    "orderconfirmation.orderConfirmedMessage": "Hemos recibido su solicitud. Nuestros diseñadores florales comenzarán a preparar su arreglo pronto.",
    "orderconfirmation.emailNotice": "Se ha enviado un recibo detallado y la factura a su dirección de correo electrónico.",
    "orderconfirmation.trackLiveStatus": "Seguimiento en Vivo",
    "orderconfirmation.backToCatalog": "Volver al Catálogo",
    "orderconfirmation.notFoundDetailedDesc": "No pudimos recuperar los detalles de confirmación para este identificador. Si acaba de realizar un pedido, verifique su correo electrónico o el panel de control.",
    "orderconfirmation.recipientHome": "Hogar de {name}",

    // productdetail
    "productdetail.backToCatalog": "Volver al Catálogo",
    "productdetail.sameDayDelivery": "Entrega el Mismo Día",
    "productdetail.occasionsLabel": "Ocasiones:",
    "productdetail.colorPaletteLabel": "Paleta de Colores:",
    "productdetail.tagsLabel": "Etiquetas:",
    "productdetail.addToCart": "Agregar al Carrito",
    "productdetail.outOfStock": "Agotado",
    "productdetail.sevenDayFreshness": "Frescura de 7 Días",
    "productdetail.sameDayEligible": "Apto para entrega el mismo día si se solicita antes de las 2 PM.",
    "productdetail.standardDelivery": "Entrega estándar de 2 días disponible.",
    "productdetail.addedToWishlist": "Agregado a la lista de deseos",
    "productdetail.removedFromWishlist": "Eliminado de la lista de deseos",

    // shop
    "shop.resultsFor": "Resultados para \"{query}\"",
    "shop.allArrangements": "Todos los Arreglos",
    "shop.filters": "Filtros",
    "shop.searchProductsPlaceholder": "Buscar productos...",
    "shop.showingResultsCount": "Mostrando {count} resultados",
    "shop.sortBy": "Ordenar por:",
    "shop.sortPopularity": "Popularidad",
    "shop.sortPriceLow": "Precio: menor a mayor",
    "shop.sortPriceHigh": "Precio: mayor a menor",
    "shop.sortNewest": "Novedades",
    "shop.occasion": "Ocasión",
    "shop.allOccasions": "Todas las Ocasiones",
    "shop.allColors": "Todos los Colores",
    "shop.delivery": "Entrega",
    "shop.allOptions": "Todas las Opciones",
    "shop.sameDayDelivery": "Entrega el Mismo Día",
    "shop.clearAllFilters": "Limpiar Filtros",

    // trackorder
    "trackorder.trackingDesc": "Ingrese los detalles de su pedido a continuación para ver el progreso de la entrega, los horarios de despacho y el estado de los arreglos.",
    "trackorder.orderNumberLabel": "Número de Pedido *",
    "trackorder.orderNumberPlaceholder": "ej. BLM-12345",
    "trackorder.senderEmailLabel": "Correo Electrónico del Remitente *",
    "trackorder.senderEmailPlaceholder": "ej. cliente@ejemplo.com",
    "trackorder.trackOrderBtn": "Rastrear Pedido",
    "trackorder.destination": "Destino",
    "trackorder.arrangements": "Arreglos",
    "trackorder.returnToStore": "Volver a la Tienda",
    "trackorder.noOrderMatch": "Ningún pedido coincide con esta combinación de Número de Pedido y Correo Electrónico. Verifique sus datos.",
    "trackorder.fetchError": "Ocurrió un error al obtener los detalles del seguimiento. Por favor intente de nuevo.",
    "trackorder.stepPlacedLabel": "Confirmado",
    "trackorder.stepPlacedDesc": "Pedido recibido y confirmado",
    "trackorder.stepInDesignLabel": "En Diseño",
    "trackorder.stepInDesignDesc": "Los floristas están seleccionando y arreglando los tallos",
    "trackorder.stepReadyLabel": "Listo",
    "trackorder.stepReadyDesc": "Ramo completado y control de calidad aprobado",
    "trackorder.stepInTransitLabel": "En Camino",
    "trackorder.stepInTransitDesc": "Asignado a la ruta del repartidor",
    "trackorder.stepDeliveredLabel": "Entregado",
    "trackorder.stepDeliveredDesc": "Entregado con éxito en mano al destinatario",

    // delivery.tracking
    "delivery.tracking.recipient": "Destinatario",
    "delivery.tracking.assignedCourier": "Repartidor Asignado",
    "delivery.tracking.car": "Auto",
    "delivery.tracking.flexibleEta": "Hora Estimada Flexible",
    "delivery.tracking.liveMapRoute": "Enlace a Ruta del Repartidor en Vivo",
    "delivery.tracking.footerMessage": "Logística BloomPro Studio. Token de destinatario seguro verificado.",
    "delivery.tracking.trackingExpiredOrInvalid": "Seguimiento Expirado o Inválido"
  },
  fr: {
    // ui
    "ui.continueShopping": "Continuer mes achats",
    "ui.custom": "Personnalisé",
    "ui.subtotal": "Sous-total",
    "ui.proceedToCheckout": "Passer à la caisse",
    
    // cart
    "cart.browseShop": "Parcourir la boutique",
    "cart.continueShopping": "Continuer mes achats",
    "cart.each": "chacun",
    "cart.remove": "Retirer",
    "cart.subtotal": "Sous-total",
    "cart.standardDeliveryEst": "Livraison Standard (Est.)",
    "cart.salesTaxEst": "Taxe sur les ventes (Est.)",
    "cart.checkoutNotice": "❀ Message de carte gratuit et emballage de signature inclus lors du paiement.",
    "cart.proceedToGuestCheckout": "Passer à la caisse en invité",
    "cart.proceedToCheckout": "Passer à la Caisse",
    
    // checkout
    "checkout.youNeedToAddItemsToYourCartBeforeProceedingToCheckout": "Vous devez ajouter des articles à votre panier avant de passer à la caisse.",
    "checkout.returnToShop": "Retour à la boutique",
    "checkout.whoIsThisFor": "Pour qui est-ce ?",
    "checkout.deliveryAddress": "Adresse de livraison",
    "checkout.selectState": "Sélectionner l'État",
    "checkout.continueToDelivery": "Continuer vers la livraison",
    "checkout.deliveryOptions": "Options de livraison",
    "checkout.arrivesOnYourSelectedDate": "Arrive à la date sélectionnée",
    "checkout.collectFromOurDowntownStudio": "À retirer à notre studio du centre-ville",
    "checkout.requestedDeliveryDate": "Date de livraison demandée",
    "checkout.continueToDetails": "Continuer vers les détails",
    "checkout.yourDetailsGiftMessage": "Vos coordonnées et message cadeau",
    "checkout.yourFullName": "Votre nom complet",
    "checkout.standardDeliveryPrice": "Livraison Standard (9,99 $)",
    "checkout.sameDayDeliveryPrice": "Livraison le jour même (19,99 $)",
    "checkout.deliveredTodayLimit": "Livré aujourd'hui avant 18h",
    "checkout.inStorePickupFree": "Retrait en magasin (Gratuit)",
    "checkout.back": "Retour",
    "checkout.emailForReceipt": "Votre adresse e-mail (pour le reçu)",
    "checkout.cardMessageOptional": "Message de carte (Optionnel)",
    "checkout.cardMessagePlaceholder": "Écrivez un mot chaleureux...",
    "checkout.payment": "Paiement",
    "checkout.cvc": "CVC",
    "checkout.cvcPlaceholder": "123",
    "checkout.payAmount": "Payer {amount}",
    "checkout.subtotal": "Sous-total",
    "checkout.delivery": "Livraison",
    "checkout.taxesEstimated": "Taxes (Estimées)",
    "checkout.total": "Total",
    "checkout.qty": "Qté",
    "checkout.cardNumber": "Numéro de Carte",
    "checkout.expiryDate": "Date d'Expiration",
    "checkout.orderSummary": "Résumé de la Commande",
    "checkout.secureCheckout": "Paiement Sécurisé",
    "checkout.stepRecipient": "1. Destinataire",
    "checkout.stepDelivery": "2. Livraison",
    "checkout.stepDetails": "3. Détails",
    "checkout.stepPayment": "4. Paiement",
    "checkout.recipientFullName": "Nom Complet du Destinataire",
    "checkout.recipientPhone": "Téléphone du Destinataire",
    "checkout.city": "Ville",
    "checkout.zipCode": "Code Postal",
    "checkout.continueToPayment": "Continuer vers le Paiement",
    "checkout.cardMessagePlaceholder": "Écrivez un mot chaleureux...",

    // custombouquet
    "custombouquet.artisanDesc": "Travaillez avec nos artisans pour créer un arrangement unique.",
    "custombouquet.stepOccasion": "Occasion",
    "custombouquet.stepPalette": "Palette de couleurs",
    "custombouquet.stepFlowers": "Préférences de fleurs",
    "custombouquet.stepSize": "Taille et budget",
    "custombouquet.stepDate": "Date de livraison",
    "custombouquet.stepMessage": "Message cadeau",
    "custombouquet.stepReview": "Récapitulatif",
    "custombouquet.whatsOccasion": "Quelle est l'occasion ?",
    "custombouquet.birthday": "Anniversaire",
    "custombouquet.anniversary": "Anniversaire de mariage",
    "custombouquet.sympathy": "Condoléances",
    "custombouquet.wedding": "Mariage",
    "custombouquet.romance": "Romance",
    "custombouquet.justBecause": "Juste comme ça",
    "custombouquet.softBlush": "Rose poudré et Crème",
    "custombouquet.classicWhites": "Blanc et Vert classiques",
    "custombouquet.warmChampagne": "Champagne et Pêche chaleureux",
    "custombouquet.deepReds": "Rouge passion profond",
    "custombouquet.vibrantColor": "Vibrant et Coloré",
    "custombouquet.floristChoice": "Choix du fleuriste",
    "custombouquet.roses": "Roses",
    "custombouquet.peonies": "Pivoines",
    "custombouquet.lilies": "Lys",
    "custombouquet.orchids": "Orchidées",
    "custombouquet.hydrangeas": "Hortensias",
    "custombouquet.tulips": "Tulipes",
    "custombouquet.ranunculus": "Renoncules",
    "custombouquet.eucalyptus": "Eucalyptus",
    "custombouquet.sizeStandardDesc": "Un bel arrangement modeste, parfait pour un bureau ou une table basse.",
    "custombouquet.sizeDeluxeDesc": "Un arrangement plus fourni avec des fleurs de qualité supérieure. Notre choix le plus populaire.",
    "custombouquet.sizePremiumDesc": "Un arrangement spectaculaire et luxueux avec nos plus belles fleurs de saison.",
    "custombouquet.addGiftMessageOptional": "Ajouter un message cadeau (Optionnel)",
    "custombouquet.writeHeartfeltMessagePlaceholder": "Écrivez votre message chaleureux ici...",
    "custombouquet.occasionLabel": "Occasion :",
    "custombouquet.paletteLabel": "Palette de couleurs :",
    "custombouquet.flowersLabel": "Fleurs :",
    "custombouquet.sizeLabel": "Taille :",
    "custombouquet.deliveryDateLabel": "Date de livraison :",
    "custombouquet.messageLabel": "Message :",
    "custombouquet.back": "Retour",
    "custombouquet.nextStep": "Étape suivante",
    "custombouquet.addToCartWithPrice": "Ajouter au Panier - {price}",

    // occasions
    "occasions.subtitle": "Trouvez l'arrangement parfait pour chaque moment spécial.",
    "occasions.shopOccasion": "Acheter {name}",

    // orderconfirmation
    "orderconfirmation.returnToStorefront": "Retour à la boutique",
    "orderconfirmation.goToTrackOrder": "Suivre la commande",
    "orderconfirmation.orderConfirmedMessage": "Nous avons bien reçu votre demande. Nos designers floraux commenceront bientôt à composer votre arrangement.",
    "orderconfirmation.emailNotice": "Un reçu détaillé et une facture ont été envoyés à votre adresse e-mail.",
    "orderconfirmation.trackLiveStatus": "Suivre en direct",
    "orderconfirmation.backToCatalog": "Retour au catalogue",
    "orderconfirmation.notFoundDetailedDesc": "Impossible de récupérer les détails de confirmation pour cet identifiant. Si vous venez de passer commande, veuillez vérifier vos e-mails ou le panneau de suivi.",
    "orderconfirmation.recipientHome": "Domicile de {name}",

    // productdetail
    "productdetail.backToCatalog": "Retour au catalogue",
    "productdetail.sameDayDelivery": "Livraison le jour même",
    "productdetail.occasionsLabel": "Occasions :",
    "productdetail.colorPaletteLabel": "Palette de couleurs :",
    "productdetail.tagsLabel": "Mots-clés :",
    "productdetail.addToCart": "Ajouter au Panier",
    "productdetail.outOfStock": "Rupture de stock",
    "productdetail.sevenDayFreshness": "Fraîcheur 7 jours",
    "productdetail.sameDayEligible": "Éligible pour une livraison le jour même si commandé avant 14h.",
    "productdetail.standardDelivery": "Livraison standard sous 2 jours disponible.",
    "productdetail.addedToWishlist": "Ajouté à la liste d'envies",
    "productdetail.removedFromWishlist": "Retiré de la liste d'envies",

    // shop
    "shop.resultsFor": "Résultats pour \"{query}\"",
    "shop.allArrangements": "Tous les arrangements",
    "shop.filters": "Filtres",
    "shop.searchProductsPlaceholder": "Rechercher des produits...",
    "shop.showingResultsCount": "Affichage de {count} résultats",
    "shop.sortBy": "Trier par :",
    "shop.sortPopularity": "Popularité",
    "shop.sortPriceLow": "Prix : du moins cher au plus cher",
    "shop.sortPriceHigh": "Prix : du plus cher au moins cher",
    "shop.sortNewest": "Nouveautés",
    "shop.occasion": "Occasion",
    "shop.allOccasions": "Toutes les occasions",
    "shop.allColors": "Toutes les couleurs",
    "shop.delivery": "Livraison",
    "shop.allOptions": "Toutes les options",
    "shop.sameDayDelivery": "Livraison le jour même",
    "shop.clearAllFilters": "Effacer tous les filtres",

    // trackorder
    "trackorder.trackingDesc": "Saisissez les détails de votre commande ci-dessous pour suivre la livraison, les horaires d'expédition et le statut de vos arrangements.",
    "trackorder.orderNumberLabel": "Numéro de commande *",
    "trackorder.orderNumberPlaceholder": "ex. BLM-12345",
    "trackorder.senderEmailLabel": "Adresse e-mail de l'expéditeur *",
    "trackorder.senderEmailPlaceholder": "ex. client@exemple.com",
    "trackorder.trackOrderBtn": "Suivre la commande",
    "trackorder.destination": "Destination",
    "trackorder.arrangements": "Arrangements",
    "trackorder.returnToStore": "Retour à la boutique",
    "trackorder.noOrderMatch": "Aucune commande ne correspond à ce numéro de commande et e-mail. Veuillez vérifier vos informations.",
    "trackorder.fetchError": "Une erreur est survenue lors de la récupération du suivi. Veuillez réessayer.",
    "trackorder.stepPlacedLabel": "Commandé",
    "trackorder.stepPlacedDesc": "Commande reçue et confirmée",
    "trackorder.stepInDesignLabel": "En préparation",
    "trackorder.stepInDesignDesc": "Nos fleuristes sélectionnent et composent vos fleurs",
    "trackorder.stepReadyLabel": "Prêt",
    "trackorder.stepReadyDesc": "Bouquet terminé et contrôlé",
    "trackorder.stepInTransitLabel": "En cours de livraison",
    "trackorder.stepInTransitDesc": "Remis à notre coursier",
    "trackorder.stepDeliveredLabel": "Livré",
    "trackorder.stepDeliveredDesc": "Remis en main propre avec succès",

    // delivery.tracking
    "delivery.tracking.recipient": "Destinataire",
    "delivery.tracking.assignedCourier": "Coursier Assigné",
    "delivery.tracking.car": "Voiture",
    "delivery.tracking.flexibleEta": "Heure d'arrivée Flexible",
    "delivery.tracking.liveMapRoute": "Lien vers l'itinéraire du coursier en direct",
    "delivery.tracking.footerMessage": "Logistique BloomPro Studio. Jeton de destinataire sécurisé vérifié.",
    "delivery.tracking.trackingExpiredOrInvalid": "Suivi Expiré ou Invalide"
  },
  nl: {
    // ui
    "ui.continueShopping": "Doorgaan met winkelen",
    "ui.custom": "Aangepast",
    "ui.subtotal": "Subtotaal",
    "ui.proceedToCheckout": "Doorgaan naar afrekenen",
    
    // cart
    "cart.browseShop": "Winkel Doorbladeren",
    "cart.continueShopping": "Doorgaan met winkelen",
    "cart.each": "per stuk",
    "cart.remove": "Verwijderen",
    "cart.subtotal": "Subtotaal",
    "cart.standardDeliveryEst": "Standaard bezorging (Schatting)",
    "cart.salesTaxEst": "Btw (Schatting)",
    "cart.checkoutNotice": "❀ Gratis kaartbericht en kenmerkende verpakking inbegrepen bij het afrekenen.",
    "cart.proceedToGuestCheckout": "Doorgaan naar afrekenen als gast",
    "cart.proceedToCheckout": "Doorgaan naar Afrekenen",
    
    // checkout
    "checkout.youNeedToAddItemsToYourCartBeforeProceedingToCheckout": "U moet artikelen aan uw winkelwagen toevoegen voordat u kunt afrekenen.",
    "checkout.returnToShop": "Terug naar winkel",
    "checkout.whoIsThisFor": "Voor wie is dit?",
    "checkout.deliveryAddress": "Bezorgadres",
    "checkout.selectState": "Selecteer provincie",
    "checkout.continueToDelivery": "Doorgaan naar bezorging",
    "checkout.deliveryOptions": "Bezorgopties",
    "checkout.arrivesOnYourSelectedDate": "Komt aan op de geselecteerde datum",
    "checkout.collectFromOurDowntownStudio": "Ophalen in onze studio in de binnenstad",
    "checkout.requestedDeliveryDate": "Gewenste bezorgdatum",
    "checkout.continueToDetails": "Doorgaan naar details",
    "checkout.yourDetailsGiftMessage": "Uw gegevens en kaartbericht",
    "checkout.yourFullName": "Uw volledige naam",
    "checkout.standardDeliveryPrice": "Standaard bezorging ($9.99)",
    "checkout.sameDayDeliveryPrice": "Bezorging op dezelfde dag ($19.99)",
    "checkout.deliveredTodayLimit": "Vandaag bezorgd voor 18:00",
    "checkout.inStorePickupFree": "Afhalen in de winkel (Gratis)",
    "checkout.back": "Terug",
    "checkout.emailForReceipt": "Uw e-mailadres (voor bon)",
    "checkout.cardMessageOptional": "Kaartbericht (Optioneel)",
    "checkout.cardMessagePlaceholder": "Schrijf een persoonlijk bericht...",
    "checkout.payment": "Betaling",
    "checkout.cvc": "CVC",
    "checkout.cvcPlaceholder": "123",
    "checkout.payAmount": "Betaal {amount}",
    "checkout.subtotal": "Subtotaal",
    "checkout.delivery": "Bezorging",
    "checkout.taxesEstimated": "Btw (Schatting)",
    "checkout.total": "Totaal",
    "checkout.qty": "Aantal",
    "checkout.cardNumber": "Kaartnummer",
    "checkout.expiryDate": "Vervaldatum",
    "checkout.orderSummary": "Besteloverzicht",
    "checkout.secureCheckout": "Veilig Afrekenen",
    "checkout.stepRecipient": "1. Ontvanger",
    "checkout.stepDelivery": "2. Bezorging",
    "checkout.stepDetails": "3. Details",
    "checkout.stepPayment": "4. Betaling",
    "checkout.recipientFullName": "Volledige naam ontvanger",
    "checkout.recipientPhone": "Telefoonnummer ontvanger",
    "checkout.city": "Stad",
    "checkout.zipCode": "Postcode",
    "checkout.continueToPayment": "Doorgaan naar Betaling",
    "checkout.cardMessagePlaceholder": "Schrijf een persoonlijk bericht...",

    // custombouquet
    "custombouquet.artisanDesc": "Werk samen met onze bloembinders om een uniek arrangement te creëren.",
    "custombouquet.stepOccasion": "Gelegenheid",
    "custombouquet.stepPalette": "Kleurenpalet",
    "custombouquet.stepFlowers": "Bloemvoorkeuren",
    "custombouquet.stepSize": "Formaat & Budget",
    "custombouquet.stepDate": "Bezorgdatum",
    "custombouquet.stepMessage": "Kaartbericht",
    "custombouquet.stepReview": "Beoordeling",
    "custombouquet.whatsOccasion": "Wat is de gelegenheid?",
    "custombouquet.birthday": "Verjaardag",
    "custombouquet.anniversary": "Jubileum",
    "custombouquet.sympathy": "Condoleance",
    "custombouquet.wedding": "Bruiloft",
    "custombouquet.romance": "Romantiek",
    "custombouquet.justBecause": "Zomaar",
    "custombouquet.softBlush": "Zacht roze & Crème",
    "custombouquet.classicWhites": "Klassiek wit & Groen",
    "custombouquet.warmChampagne": "Warm champagne & Perzik",
    "custombouquet.deepReds": "Dieprood romantisch",
    "custombouquet.vibrantColor": "Levendig & Kleurrijk",
    "custombouquet.floristChoice": "Keuze van de bloemist",
    "custombouquet.roses": "Rozen",
    "custombouquet.peonies": "Pioenrozen",
    "custombouquet.lilies": "Lelies",
    "custombouquet.orchids": "Orchideeën",
    "custombouquet.hydrangeas": "Hortensia's",
    "custombouquet.tulips": "Tulpen",
    "custombouquet.ranunculus": "Ranonkels",
    "custombouquet.eucalyptus": "Eucalyptus",
    "custombouquet.sizeStandardDesc": "Een mooi, bescheiden arrangement perfect voor een bureau of bijzettafel.",
    "custombouquet.sizeDeluxeDesc": "Een voller arrangement met premium bloemen. Onze meest populaire keuze.",
    "custombouquet.sizePremiumDesc": "Een indrukwekkend, luxueus arrangement met onze allermooiste seizoensbloemen.",
    "custombouquet.addGiftMessageOptional": "Kaartbericht toevoegen (Optioneel)",
    "custombouquet.writeHeartfeltMessagePlaceholder": "Schrijf hier uw persoonlijke bericht...",
    "custombouquet.occasionLabel": "Gelegenheid:",
    "custombouquet.paletteLabel": "Kleurenpalet:",
    "custombouquet.flowersLabel": "Bloemen:",
    "custombouquet.sizeLabel": "Formaat:",
    "custombouquet.deliveryDateLabel": "Bezorgdatum:",
    "custombouquet.messageLabel": "Kaartbericht:",
    "custombouquet.back": "Terug",
    "custombouquet.nextStep": "Volgende stap",
    "custombouquet.addToCartWithPrice": "In winkelwagen - {price}",

    // occasions
    "occasions.subtitle": "Vind het perfecte arrangement voor elk bijzonder moment.",
    "occasions.shopOccasion": "Shop {name}",

    // orderconfirmation
    "orderconfirmation.returnToStorefront": "Terug naar winkel",
    "orderconfirmation.goToTrackOrder": "Naar bestelling volgen",
    "orderconfirmation.orderConfirmedMessage": "We hebben uw bestelling ontvangen. Onze bloembinders gaan er snel mee aan de slag.",
    "orderconfirmation.emailNotice": "Een gedetailleerde bon en factuur zijn naar uw e-mailadres verzonden.",
    "orderconfirmation.trackLiveStatus": "Volg live status",
    "orderconfirmation.backToCatalog": "Terug naar catalogus",
    "orderconfirmation.notFoundDetailedDesc": "We konden geen bevestigingsgegevens vinden voor deze bestelling. Als u zojuist besteld heeft, controleer dan uw e-mail of de trackingpagina.",
    "orderconfirmation.recipientHome": "Huis van {name}",

    // productdetail
    "productdetail.backToCatalog": "Terug naar catalogus",
    "productdetail.sameDayDelivery": "Bezorging op dezelfde dag",
    "productdetail.occasionsLabel": "Gelegenheden:",
    "productdetail.colorPaletteLabel": "Kleurenpalet:",
    "productdetail.tagsLabel": "Tags:",
    "productdetail.addToCart": "In winkelwagen",
    "productdetail.outOfStock": "Niet op voorraad",
    "productdetail.sevenDayFreshness": "7 dagen versgarantie",
    "productdetail.sameDayEligible": "Komt in aanmerking voor bezorging op dezelfde dag indien besteld voor 14:00.",
    "productdetail.standardDelivery": "Standaard 2-daagse bezorging beschikbaar.",
    "productdetail.addedToWishlist": "Toegevoegd aan verlanglijst",
    "productdetail.removedFromWishlist": "Verwijderd van verlanglijst",

    // shop
    "shop.resultsFor": "Resultaten voor \"{query}\"",
    "shop.allArrangements": "Alle arrangementen",
    "shop.filters": "Filters",
    "shop.searchProductsPlaceholder": "Zoeken naar producten...",
    "shop.showingResultsCount": "Toont {count} resultaten",
    "shop.sortBy": "Sorteren op:",
    "shop.sortPopularity": "Populariteit",
    "shop.sortPriceLow": "Prijs: laag naar hoog",
    "shop.sortPriceHigh": "Prijs: hoog naar laag",
    "shop.sortNewest": "Nieuwste",
    "shop.occasion": "Gelegenheid",
    "shop.allOccasions": "Alle gelegenheden",
    "shop.allColors": "Alle kleuren",
    "shop.delivery": "Bezorging",
    "shop.allOptions": "Alle opties",
    "shop.sameDayDelivery": "Bezorging op dezelfde dag",
    "shop.clearAllFilters": "Filters wissen",

    // trackorder
    "trackorder.trackingDesc": "Voer hieronder uw bestelgegevens in om de bezorgstatus, het verzendschema en de status van de bloemen te bekijken.",
    "trackorder.orderNumberLabel": "Bestelnummer *",
    "trackorder.orderNumberPlaceholder": "bijv. BLM-12345",
    "trackorder.senderEmailLabel": "E-mailadres afzender *",
    "trackorder.senderEmailPlaceholder": "bijv. klant@voorbeeld.nl",
    "trackorder.trackOrderBtn": "Volg bestelling",
    "trackorder.destination": "Bestemming",
    "trackorder.arrangements": "Arrangements",
    "trackorder.returnToStore": "Terug naar winkel",
    "trackorder.noOrderMatch": "Er is geen bestelling gevonden voor deze combinatie van bestelnummer en e-mailadres.",
    "trackorder.fetchError": "Er is een fout opgetreden bij het ophalen van de status. Probeer het opnieuw.",
    "trackorder.stepPlacedLabel": "Geplaatst",
    "trackorder.stepPlacedDesc": "Bestelling ontvangen en bevestigd",
    "trackorder.stepInDesignLabel": "In bloembinderij",
    "trackorder.stepInDesignDesc": "Bloemisten selecteren en binden de bloemen",
    "trackorder.stepReadyLabel": "Klaar",
    "trackorder.stepReadyDesc": "Boeket klaar en kwaliteitscontrole uitgevoerd",
    "trackorder.stepInTransitLabel": "Onderweg",
    "trackorder.stepInTransitDesc": "Overgedragen aan bezorger",
    "trackorder.stepDeliveredLabel": "Bezorgd",
    "trackorder.stepDeliveredDesc": "Succesvol overhandigd aan de ontvanger",

    // delivery.tracking
    "delivery.tracking.recipient": "Ontvanger",
    "delivery.tracking.assignedCourier": "Bezorger Toegewezen",
    "delivery.tracking.car": "Auto",
    "delivery.tracking.flexibleEta": "Flexibele Bezorgtijd",
    "delivery.tracking.liveMapRoute": "Link naar Live Bezorgroute",
    "delivery.tracking.footerMessage": "BloomPro Studio Logistiek. Beveiligd ontvangerstoken geverifieerd.",
    "delivery.tracking.trackingExpiredOrInvalid": "Tracking verlopen of ongeldig"
  }
};

function processLocaleFile(lang, filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Strip export to parse
  const varName = lang === 'es' ? 'esUS' : (lang === 'fr' ? 'frFR' : 'nlNL');
  const cleaned = content
    .replace(new RegExp(`export\\s+const\\s+${varName}\\s*=\\s*`), '')
    .trim()
    .replace(/;$/, '');
  
  const obj = new Function(`return (${cleaned})`)();
  
  // Merge missing translations
  const dict = translations[lang];
  
  function merge(target, sourcePath = '') {
    for (const key in target) {
      const currentPath = sourcePath ? `${sourcePath}.${key}` : key;
      if (typeof target[key] === 'object' && target[key] !== null && !Array.isArray(target[key])) {
        merge(target[key], currentPath);
      } else {
        if (dict[currentPath]) {
          target[key] = dict[currentPath];
        }
      }
    }
  }
  
  // Also we want to ensure any completely missing namespace or key gets added
  // Let's first build a list of flat keys we expect (based on en-US keys)
  const enContent = fs.readFileSync(path.join(localesDir, 'en-US.ts'), 'utf-8');
  const enCleaned = enContent.replace(/export\s+const\s+enUS\s*=\s*/, '').trim().replace(/;$/, '');
  const enObj = new Function(`return (${enCleaned})`)();
  
  function ensureAllKeys(targetObj, templateObj, pathPrefix = '') {
    for (const key in templateObj) {
      const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;
      if (typeof templateObj[key] === 'object' && templateObj[key] !== null && !Array.isArray(templateObj[key])) {
        if (!targetObj[key]) {
          targetObj[key] = {};
        }
        ensureAllKeys(targetObj[key], templateObj[key], currentPath);
      } else {
        if (targetObj[key] === undefined || targetObj[key] === templateObj[key]) {
          // It's missing or still has English placeholder value, set translated value or fallback
          targetObj[key] = dict[currentPath] || templateObj[key];
        }
      }
    }
  }
  
  ensureAllKeys(obj, enObj);
  
  // Write back to file with identical format
  const stringified = JSON.stringify(obj, null, 2);
  const output = `export const ${varName} = ${stringified};\n`;
  fs.writeFileSync(filePath, output);
  console.log(`Updated ${filePath}`);
}

processLocaleFile('es', path.join(localesDir, 'es-US.ts'));
processLocaleFile('fr', path.join(localesDir, 'fr-FR.ts'));
processLocaleFile('nl', path.join(localesDir, 'nl-NL.ts'));
