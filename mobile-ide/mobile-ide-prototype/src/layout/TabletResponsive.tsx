import React from 'react';
import {View, useWindowDimensions} from 'react-native';

const TabletResponsive = ({children}: {children: React.ReactNode}) => {
  const {width} = useWindowDimensions();
  const isTablet = width > 768;

  return (
    <View style={{flex: 1, flexDirection: isTablet ? 'row' : 'column'}}>
      {children}
    </View>
  );
};

export default TabletResponsive;
