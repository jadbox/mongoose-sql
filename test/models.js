const _Schema = require('mongoose').Schema;

function init(Schema) { //Schema
  if(!Schema) Schema = _Schema;
  
  const Package = {

    name: {
      type: String,
      default: '',
      trim: true,
      required: 'Name cannot be blank'
    },
    cptPackageId: {
      type: Number,
      required: 'CPT package ID is required'
    },
    cptPackageName: {
      type: String
    },
    cardImage: {
      type: String
    },
    featureSticker: {
      type: Schema.ObjectId,
      ref: 'Sticker'
    },
    category: {
      type: Schema.ObjectId,
      ref: 'Category'
    },
    onReserve: {
      type: Boolean,
      default: false
    },
    priority: {
      type: Number
    },

    customTrailer: {
      type: String
    },
    description: {
      type: String
    },

    segments: [{
      type: String
    }],

    oneSheet: {
      type: String
    },

    caseStudy: {
      type: String
    },

    insightsDeck: {
      type: String
    },

    insightsDeckFileName: { // TODO NEW PROP //pkgStatsVisibility?
      type: String // ?
    },
    oneSheetFileName: {
      type: String
    },
    //====

    featuredVideos: [{
      type: String
    }],

    recommendedPackages: [{
      type: Schema.ObjectId,
      ref: 'Package'
    }],

    videoExamples: [{
      numViews: {
        type: Number
      },
      publishTs: {
        type: String
      },
      title: {
        type: String
      },
      ytVideoId: {
        type: String
      },
    }],


    statsCache: {
      statistics: {
        type: Object
      },
      timeSeries: {
        type: Object
      },
      date: {
        type: Date
      }
    },


    cartridgeIdsCache: {
      cartridgeIds: {
        type: Array
      },
      date: {
        type: Date
      }
    },


    pkgOverRides: {
      numViews: {
        type: Number,
        default: null
      },
      numVideos: {
        type: Number,
        default: null
      },
      numSubscribers: {
        type: Number,
        default: null
      },
      forecastedImpressions: {
        type: Number,
        default: null
      },
      numEngagements: {
        type: Number,
        default: null
      },
      numChannels: {
        type: Number,
        default: null
      },
      avgForecastedViews: {
        type: Number,
        default: null
      }
    },

    pkgStatsVisibility: {
      numViews: {
        type: Boolean,
        default: false
      },
      numVideos: {
        type: Boolean,
        default: false
      },
      numSubscribers: {
        type: Boolean,
        default: false
      },
      forecastedImpressions: {
        type: Boolean,
        default: false
      },
      numEngagements: {
        type: Boolean,
        default: false
      },
      numChannels: {
        type: Boolean,
        default: false
      },
      avgForecastedViews: {
        type: Boolean,
        default: false
      }
    },

    zInfluencers: [{
      type: Number
    }],


    status: {
      type: String,
      default: 'coming soon'
    },

    created: {
      type: Date,
      default: Date.now
    },

    updated: {
      type: Date,
      default: Date.now
    }
  }

  const Category = {
    priority: {
      type: Number
    },
    created: {
      type: Date,
      default: Date.now
    },
    title: {
      type: String,
      default: '',
      trim: true,
      required: 'Title cannot be blank',
      unique: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    posh: {
      type: Boolean,
      default: false
    }
  };

  const Sticker = {
    created: {
      type: Date,
      default: Date.now
    },
    label: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
      required: 'label cannot be blank',
      unique: true
    }
  };

  const Cache = {
    url: {
      type: String
    },
    response: {
      type: String
    },
    timeStamp: {
      type: Date,
      expires: 2628000
    }
  };


  const LogLevel = {
    level: {
      type: String,
      default: 'error'
    }
  };

  const Post = {
    date: {
      type: Date,
      default: Date.now
    },
    message: {
      type: String,
      default: '',
      trim: true
    },
    owner: {
      type: Schema.ObjectId,
      ref: 'User',
      type: String
    },
    email: {
      type: String
    }
  };

  const User = {
    name: {
      type: String,
      trim: true,
      default: ''
    },
    email: {
      type: String,
      trim: true,
      unique: true,
      default: '',
      required: 'Please fill in your email'
    },
    password: {
      type: String,
      default: ''
    },
    salt: { type: String },
    role:{
      type: String,
      default: 'user'
    },
    updated: { type: Date },
    created: {
      type: Date,
      default: Date.now
    }
  };

  Banner = {
    created: {
      type: Date,
      default: Date.now
    },
    title: {
      type: String,
      default: '',
      trim: true,
      required: 'Title cannot be blank!'
    },
    image: {
      type: String,
      trim: true,
      required: 'Banners must have images!'
    },
    foreground: {
      type: String,
      trim: true
    },
    priority: { type: Number },
    active: { type: Boolean },
    activeDate: { type: Date },
    headline:{
      type: String,
      required: 'Banners must have headlines!'
    },
    caption: { type: String },
    captionPosition: { type: String },
    captionColor: { type: String },
    package: {
      type: Schema.ObjectId,
      ref: 'Package',
      //required: 'Banners must be associated with a package!' // taking this out by design
    }
  };

  return {
    Package,
    Category,
    Sticker,
    Cache,
    LogLevel,
    Post,
    User,
    Banner
  };

}

module.exports = exports = { init };